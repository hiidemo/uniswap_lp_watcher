require('dotenv').config()
const Notifier = require('./notifier');

const ServiceManager = require('./services/service-manager');
const UniswapLpService = require('./services/uniswap-lp-service');
ServiceManager.add(new UniswapLpService('UniswapLpService', 180000));

const TelegramBotService = require('./services/telegram-bot-service');
ServiceManager.add(new TelegramBotService('TelegramBotService'));

ServiceManager.start();