const fs = require('fs');
const { JSBI }  = require("@uniswap/sdk");
const { ethers, BigNumber } = require('ethers');
const db = require("../db");
const Notifier = require("../notifier");
const BaseService = require("./base-service");

var NETWORK = {
  eth: {
      endpoint_url: '',
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      NFTmanager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  },
  arb: {
      endpoint_url: process.env.ENDPOINT_ARB_URL,
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      NFTmanager: '0x91ae842A5Ffd8d12023116943e72A606179294f3'
  },
  celo: {
      endpoint_url: process.env.ENDPOINT_CELO_URL,
      factory: '0xAfE208a311B21f13EF87E33A90049fC17A7acDEc',
      NFTmanager: '0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A'
  },
  base: {
      endpoint_url: process.env.ENDPOINT_BASE_URL,
      factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      NFTmanager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1'
  },
  op: {
      endpoint_url: process.env.ENDPOINT_OP_URL,
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      NFTmanager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  },
  blast: {
      endpoint_url: process.env.ENDPOINT_BLAST_URL,
      factory: '0x792edAdE80af5fC680d96a2eD80A44247D2Cf6Fd',
      NFTmanager: '0xB218e4f7cF0533d4696fDfC419A0023D33345F28'
  },
  polygon: {
      endpoint_url: process.env.ENDPOINT_POLYGON_URL,
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      NFTmanager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
  },
  bsc: {
      endpoint_url: process.env.ENDPOINT_BSC_URL,
      factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
      NFTmanager: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613'
  },
  avax: {
      endpoint_url: process.env.ENDPOINT_AVAX_URL,
      factory: '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD',
      NFTmanager: '0x655C406EBFa14EE2006250925e54ec43AD184f8B'
  }
      
};

// Handle the secret text (e.g. password).
// var POOL_ID = readlineSync.question('Enter Pool ID (I.e. 51694) ');


  // ERC20 json abi file
let ERC20Abi = fs.readFileSync('required_files/Erc20.json');
const ERC20 = JSON.parse(ERC20Abi);

  // V3 pool abi json file
let pool = fs.readFileSync('required_files/V3PairAbi.json');
const IUniswapV3PoolABI = JSON.parse(pool);

  // V3 factory abi json
let facto = fs.readFileSync('required_files/V3factory.json');
const IUniswapV3FactoryABI = JSON.parse(facto);

let NFT = fs.readFileSync('required_files/UniV3NFT.json');
const IUniswapV3NFTmanagerABI = JSON.parse(NFT);

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

/////////////////////////////////////////////////////////////////
module.exports = class UniswapLpService extends BaseService {
  constructor(name, schedule) {
    super(name, schedule);
    this.sentMessages = [];
  }
  async run() {
    // console.log("Checking Uniswap LPs");

    let lp_watchers = await db.getPoolWatchers();
    
    if (lp_watchers.length > 0) {
      for (var lp of lp_watchers) {
        if (typeof NETWORK[lp.source] === 'undefined') {
          console.log("No network data for " + lp.source);
          continue;
        }

        console.log("Checking LP " + lp.id + " from " + lp.source);
        
        let data_lp = await this.getLP(lp);
        if (data_lp.amount0 * data_lp.amount1 <= 0) { // LP is out of range
          if (!this.sentMessages.includes(lp.userid + '_' + lp.id + '_' + lp.source)) {
            Notifier.notify(lp.userid,
              data_lp.pair + " (" + lp.id + " - " + lp.source + ")",
              "👉 warning: LP is out of range ==> " + data_lp.amount0Human + "|" + data_lp.amount1Human
            );
            this.sentMessages.push(lp.userid + '_' + lp.id + '_' + lp.source);
          }
        } else if (lp.warning_level > 0 && data_lp.amount0 * data_lp.amount1 > 0) { // notification when one of tokens is below given ratio
            
        } else {
          if (this.sentMessages.includes(lp.userid + '_' + lp.id + '_' + lp.source)) {
            Notifier.notify(lp.userid,
              data_lp.pair + " (" + lp.id + " - " + lp.source + ")",
              "LP is back in range"
            );
            this.sentMessages.splice(this.sentMessages.indexOf(lp.userid + '_' + lp.id + '_' + lp.source), 1);
          }
        }

        db.updateLastCheckedPool(lp.userid, lp.id, lp.source, data_lp.pair + " => " + data_lp.amount0Human + "|" + data_lp.amount1Human + "\n    🔥reward => " + data_lp.fee0Human + "|" + data_lp.fee1Human + " 🔥");
      }
    } else {
      console.log("No LPs to check");
    }

    console.log("Sleeping for " + this.schedule/(60 * 1000) + " minutes");
  }

  getLP = async function (lp) {
    const provider = new ethers.providers.JsonRpcProvider(NETWORK[lp.source].endpoint_url);
    const factory = NETWORK[lp.source].factory;
    const NFTmanager = NETWORK[lp.source].NFTmanager;

    const data = await getData(lp.id, provider, factory, NFTmanager);
    const tokens = await getTokenAmounts(data.liquidity, data.SqrtX96, data.tickLow, data.tickHigh, data.T0d, data.T1d);

    return {
      pair: data.Pair,
      amount0: tokens[0],
      amount1: tokens[1],
      amount0Human: _format_units(tokens[0], data.T0d, 4),
      amount1Human: _format_units(tokens[1], data.T1d, 4),
      fee0Human: _format_units(data.T0f, data.T0d, 4),
      fee1Human: _format_units(data.T1f, data.T1d, 4),
    }
  }
};

//////////////////////////////////////////////////////////////


async function getData(tokenID, provider, factory, NFTmanager){

    let FactoryContract = new ethers.Contract(factory, IUniswapV3FactoryABI, provider);

    let NFTContract =  new ethers.Contract(NFTmanager, IUniswapV3NFTmanagerABI, provider);
    let position = await NFTContract.positions(tokenID);
    
    let token0contract =  new ethers.Contract(position.token0, ERC20, provider);
    let token1contract =  new ethers.Contract(position.token1, ERC20, provider);
    let token0Decimal = await token0contract.decimals();
    let token1Decimal = await token1contract.decimals();
    
    let token0sym = await token0contract.symbol();
    let token1sym = await token1contract.symbol();
    
    let V3pool = await FactoryContract.getPool(position.token0, position.token1, position.fee);
    let poolContract = new ethers.Contract(V3pool, IUniswapV3PoolABI, provider);

    let slot0 = await poolContract.slot0();

    // fee
    const encoded = {
        tokenId: tokenID,
        recipient: '0x0000000000000000000000000000000000000000',
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
    };
    const tx = await NFTContract.callStatic.collect(encoded);
    const token0Fees = tx[0];
    const token1Fees = tx[1];

    let pairName = token0sym +"/"+ token1sym;
    
    const dict = {"SqrtX96" : slot0.sqrtPriceX96.toString(), "Pair": pairName, "T0d": token0Decimal, "T1d": token1Decimal, "T0f": token0Fees, "T1f": token1Fees, "tickLow": position.tickLower, "tickHigh": position.tickUpper, "liquidity": position.liquidity.toString()}

    return dict
}

function getTickAtSqrtRatio(sqrtPriceX96){
    let tick = Math.floor(Math.log((sqrtPriceX96/Q96)**2)/Math.log(1.0001));
    return tick;
}

async function getTokenAmounts(liquidity,sqrtPriceX96,tickLow,tickHigh,token0Decimal,token1Decimal){
    let sqrtRatioA = Math.sqrt(1.0001**tickLow).toFixed(18);
    let sqrtRatioB = Math.sqrt(1.0001**tickHigh).toFixed(18);
    let currentTick = getTickAtSqrtRatio(sqrtPriceX96);
    let sqrtPrice = sqrtPriceX96 / Q96;
    let amount0wei = 0;
    let amount1wei = 0;
    if(currentTick <= tickLow){
        amount0wei = Math.floor(liquidity*((sqrtRatioB-sqrtRatioA)/(sqrtRatioA*sqrtRatioB)));
    }
    if(currentTick > tickHigh){
        amount1wei = Math.floor(liquidity*(sqrtRatioB-sqrtRatioA));
    }
    if(currentTick >= tickLow && currentTick < tickHigh){ 
        amount0wei = Math.floor(liquidity*((sqrtRatioB-sqrtPrice)/(sqrtPrice*sqrtRatioB)));
        amount1wei = Math.floor(liquidity*(sqrtPrice-sqrtRatioA));
    }

    // console.log("Amount Token0 wei: "+amount0wei);
    // console.log("Amount Token1 wei: "+amount1wei);
    
    return [amount0wei, amount1wei]
}

/**
 * Format a value in raw units to a human-readable format.
 * @param {BigNumber | string} value - The value to format.
 * @param {number} units - The number of decimal units to format the value.
 * @param {number} decimals - The number of decimal to show.
 * @returns {string} The formatted fee value as a string.
 */
function _format_units(value, units, decimals = null) {
  decimals = decimals || units;
  return (value/(10**units)).toFixed(decimals);
}