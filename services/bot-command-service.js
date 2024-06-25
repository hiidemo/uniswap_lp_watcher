const { Telegraf, Markup } = require('telegraf');
const BaseService = require("./base-service");
const Notifier = require("../notifier");
const db = require("../db");
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const networks = ["eth", "arb", "celo", "base", "op", "blast", "polygon"];

module.exports = class BotCommandService extends BaseService {
  constructor(name) {
    super(name);
  }
  async run() {
    bot.start((ctx) => {
      ctx.reply(
        "Welcome to your Telegram bot! Use /help to see available commands."
      );
    });

    bot.help((ctx) => {
      ctx.reply("Available commands:\n/addlp - Create a new lp watcher\n/removelp - Remove a lp watcher");
    });

    bot.command("addlp", (ctx) => {
      ctx.reply("Please enter the ID of Uniswap pool you want to watch:");
      bot.on("text", async (ctx) => {
        const pool_id = ctx.message.text;

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
		// bot.action(/.+/, (ctx) => {
		// 	if (ctx.match[1] in networks) {
		// 		source = ctx.match[1];

		// 		return ctx.answerCbQuery(`You have chosen ${ctx.match[0]} network`)
		// 	}
		// });

		ctx.reply("Please enter a Network (ETH/CELO/ARB/BASE/OP/BLAST/POLYGON):");
		bot.on("text", async (ctx) => {
			let source = ctx.message.text;
			source = source.toLowerCase().trim();
			console.debug(networks);

			if (networks.includes(source)) {
				// Call a function to add lp
				let res = db.addPoolWatcher(pool_id, source);
				if (res) {
					Notifier.notify('Add LP - ' + pool_id, 'LP was added!');
				} else {
					Notifier.notify('Add LP - ' + pool_id, 'Error adding LP!');
				}
			}
		});

      });
    });

	bot.command('removelp', (ctx) => {
		let watchers = db.getPoolWatchers();
		let _markup = [];
		watchers.forEach(function(watcher) {
			_markup.push([
				Markup.button.callback(watcher.id + " (" + watcher.source + ")", watcher.id)
			]);
		});
		ctx.reply('Choose a <b>LP</b> to remove', {
			parse_mode: 'HTML',
			...Markup.inlineKeyboard(_markup)
		});

		bot.action(/.+/, (ctx) => {
			// Call a function to remove lp
			let pool_id = ctx.match[0];
			let res = db.removePoolWatcher(pool_id);
			Notifier.notify('Remove LP - ' + pool_id, 'LP was removed!');
			return ctx.answerCbQuery(`You have chosen ${ctx.match[0]}`)
		});
	});	
	  
	bot.command('listlp', () => {
		let watchers = db.getPoolWatchers();
		let msg = "";
		let n = 0;
		watchers.forEach(function(watcher) {
			n++;
			msg += n + ". " + watcher.id + " - " + watcher.source + "\n";
		})
		Notifier.notify('List LPs', msg);
	});	
	  
	bot.launch();

	// Enable graceful stop
	process.once('SIGINT', () => bot.stop('SIGINT'));
	process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
};