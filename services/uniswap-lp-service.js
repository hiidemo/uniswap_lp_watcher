const fs = require('fs');
const { JSBI }  = require("@uniswap/sdk");
const { ethers } = require('ethers');
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

// const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/31f2f496e0c7454b80715c158f52ead6");

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));

/////////////////////////////////////////////////////////////////
module.exports = class UniswapLpService extends BaseService {
  constructor(name, schedule) {
    super(name, schedule);
    this.sentMessages = [];
  }
  async run() {
    // console.log("Checking Uniswap LPs");

    let lp_watchers = await db.getPoolWatchers();
    let provider = null;
    let factory = null;
    let NFTmanager = null;

    if (lp_watchers.length > 0) {
      for (var lp of lp_watchers) {
        if (typeof NETWORK[lp.source] === 'undefined') {
          console.log("No network data for " + lp.source);
          continue;
        }

        console.log("Checking LP " + lp.id + " from " + lp.source);
        
        provider = new ethers.providers.JsonRpcProvider(NETWORK[lp.source].endpoint_url);
        factory = NETWORK[lp.source].factory;
        NFTmanager = NETWORK[lp.source].NFTmanager;

        let data = await getData(lp.id, provider, factory, NFTmanager);
        let tokens = await getTokenAmounts(data.liquidity, data.SqrtX96, data.tickLow, data.tickHigh, data.T0d, data.T1d);
        if (tokens[0] * tokens[1] <= 0) { // LP is out of range
          if (!this.sentMessages.includes(lp.id)) {
            let amount0Human = (tokens[0]/(10**data.T0d)).toFixed(data.T0d);
            let amount1Human = (tokens[1]/(10**data.T1d)).toFixed(data.T1d);

            Notifier.notify(
              data.Pair + " (" + lp.source + ")",
              "👉 warning: LP is out of range ==> " + amount0Human + "|" + amount1Human
            );
            this.sentMessages.push(lp.id);
          }
        } else {
          if (this.sentMessages.includes(lp.id)) {
            Notifier.notify(
              data.Pair + " (" + lp.source + ")",
              "LP is back in range"
            );
            this.sentMessages.splice(this.sentMessages.indexOf(lp.id), 1);
          }
        }
      }

      console.log("Sleeping for " + this.schedule/(60 * 1000) + " minutes");
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

    
    let pairName = token0sym +"/"+ token1sym;
    
    let dict = {"SqrtX96" : slot0.sqrtPriceX96.toString(), "Pair": pairName, "T0d": token0Decimal, "T1d": token1Decimal, "tickLow": position.tickLower, "tickHigh": position.tickUpper, "liquidity": position.liquidity.toString()}

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

async function start_test(positionID, provider, factory, NFTmanager){
    let data = await getData(positionID, provider, factory, NFTmanager);
    console.log(data);
    let tokens = await getTokenAmounts(data.liquidity, data.SqrtX96, data.tickLow, data.tickHigh, data.T0d, data.T1d);

    let amount0Human = (tokens[0]/(10**data.T0d)).toFixed(data.T0d);
    let amount1Human = (tokens[1]/(10**data.T1d)).toFixed(data.T1d);

    console.log(data.Pair + ": "+amount0Human+"|"+amount1Human);
}