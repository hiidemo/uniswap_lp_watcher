require('dotenv').config()
const Notifier = require('./notifier');

const ServiceManager = require('./services/service-manager');
const UniswapLpService = require('./services/uniswap-lp-service');
ServiceManager.add(new UniswapLpService('UniswapLpService', 180000));

const BotCommandService = require('./services/bot-command-service');
ServiceManager.add(new BotCommandService('BotCommandService'));

ServiceManager.start();