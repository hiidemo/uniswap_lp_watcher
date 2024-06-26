const { Telegraf, Markup } = require('telegraf');
const BaseService = require("./base-service");
const UniswapLpService = require('./uniswap-lp-service');
const Notifier = require("../notifier");
const db = require("../db");
const BOT = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const LISTENER = {
	status: false,
};
// Temp Array to Store the Step
let STEP = [];

// Global LP Object
const LP = {
	id: 0,
	source: '',
};

const networks = ["eth", "arb", "celo", "base", "op", "blast", "polygon"];

module.exports = class TelegramBotService extends BaseService {
  constructor(name) {
    super(name);
  }
  async run() {
    BOT.start((ctx) => {
      ctx.reply(
        "Welcome to your Telegram bot! Use /help to see available commands."
      );
    });

    BOT.help((ctx) => {
      ctx.reply("Available commands:\n/addlp - Create a new lp watcher\n/removelp - Remove a lp watcher");
    });

    BOT.command("addlp", (ctx) => {
      ctx.reply("--Please enter the ID of Uniswap pool you want to watch:");
	  LISTENER.status = true;
    });

	BOT.command('removelp', (ctx) => {
		let watchers = db.getPoolWatchers();
		let _markup = [];
		watchers.forEach(function(watcher) {
			_markup.push([
				Markup.button.callback(watcher.id + " (" + watcher.source.toUpperCase() + ")", watcher.id)
			]);
		});
		ctx.reply('Choose a <b>LP</b> to remove', {
			parse_mode: 'HTML',
			...Markup.inlineKeyboard(_markup)
		});

		BOT.action(/.+/, (ctx) => {
			// Call a function to remove lp
			let pool_id = ctx.match[0];
			let res = db.removePoolWatcher(pool_id);
			Notifier.notify('Remove LP - ' + pool_id, 'LP was removed!');
			return ctx.answerCbQuery(`You have chosen ${ctx.match[0]}`)
		});
	});	
	  
	BOT.command('listlp', (ctx) => {
		let watchers = db.getPoolWatchers();
		let msg = "";
		let n = 0;
		watchers.forEach(function(lp) {
			n++;

			msg += n + ". <b>" + lp.id + " - " + lp.source.toUpperCase() + "</b>\n";
			msg += "    <i>" + lp.last_checked + "</i>\n";
		})
		ctx.reply(msg, {parse_mode: 'HTML'});

		// Notifier.notify('List LPs', msg);
	});	
	
	BOT.on("text", async (ctx) => {
		if (!LISTENER.status) return;

        const text = ctx.message.text;

		if (STEP.length == 0) {
			try {
				let pool_id = text
				if (!pool_id || pool_id <= 0) return ctx.reply("--ERROR: invalid LP id--");
	
				LP.id = pool_id;

				STEP.push(1);
				ctx.reply("--Please enter a Network (ETH/CELO/ARB/BASE/OP/BLAST/POLYGON):");
				return;
			} catch (err) {
				ctx.reply("--ERROR: INVALID URL--");
				console.log(err.message);
			}
			return;
		}

		if (STEP.length == 1) {
			try {
				let network = text.toLowerCase().trim();
				if (!network ||!networks.includes(network)) return ctx.reply("--ERROR: invalid network--");

				LP.source = network;
				let res = db.addPoolWatcher(LP.id, LP.source);
				if (res) {
					Notifier.notify('Add LP - ' + LP.id, 'LP was added!');
				} else {
					Notifier.notify('Add LP - ' + LP.id, 'Error adding LP!');
				}
			} catch (err) {
				ctx.reply("--ERROR: A execption has occurred--");
				console.log(err.message);
			}

			resetCommand();
			return;

		}
		// ctx.reply('Choose a <b>Flatform</b>', {
		// 	parse_mode: 'HTML',
		// 	...Markup.inlineKeyboard([
		// 		Markup.button.callback('ETH', 'eth'),
		// 		Markup.button.callback('CELO', 'celo'),
		// 		Markup.button.callback('ARB', 'arb'),
		// 		Markup.button.callback('BASE', 'base'),
		// 		Markup.button.callback('OP', 'op'),
		// 		Markup.button.callback('BLAST', 'blast'),
		// 		Markup.button.callback('POLYGON', 'polygon')
		// 	])
		// });
		// BOT.action(/.+/, (ctx) => {
		// 	if (ctx.match[1] in networks) {
		// 		source = ctx.match[1];

		// 		return ctx.answerCbQuery(`You have chosen ${ctx.match[0]} network`)
		// 	}
		// });
	});

	BOT.launch();

	// Enable graceful stop
	process.once('SIGINT', () => BOT.stop('SIGINT'));
	process.once('SIGTERM', () => BOT.stop('SIGTERM'));
  }
};

// Reset command after it finished
function resetCommand() {
	STEP = [];

	LP.id = 0;
	LP.source = "";

	LISTENER.status = false;
	return;
}
