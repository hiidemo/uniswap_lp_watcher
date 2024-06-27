import { JSBI } from "@uniswap/sdk";
import { ethers, BigNumber } from 'ethers';
import * as fs from 'fs';
import readline from 'readline';
import readlineSync from 'readline-sync';
import { Database } from "bun:sqlite";

const Notifier = require('./notifier');
const db = new Database("db.sqlite");

////
//// User input for Alchemy url/id and LP Pool
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
var POOL_ID = readlineSync.question('Enter Pool ID (I.e. 51694) ');


    // ERC20 json abi file
let ERC20Abi = fs.readFileSync('required_files/Erc20.json');
const ERC20 = JSON.parse(ERC20Abi);

    // V3 pool abi json file
let pool = fs.readFileSync('required_files/V3PairAbi.json');
const IUniswapV3PoolABI = JSON.parse(pool);

    // V3 factory abi json
let facto = fs.readFileSync('required_files/V3factory.json');
const IUniswapV3FactoryABI = JSON.parse(facto);
let factory = NETWORK.celo.factory;

let NFT = fs.readFileSync('required_files/UniV3NFT.json');
const IUniswapV3NFTmanagerABI = JSON.parse(NFT);
let NFTmanager = NETWORK.celo.NFTmanager;

const provider = new ethers.providers.JsonRpcProvider(NETWORK.celo.endpoint_url);
// const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/31f2f496e0c7454b80715c158f52ead6");

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);

function addPoolWatcher(poolId, source) {
    let lp_watcher = db.query(
        "INSERT INTO lp_watcher (id, source, last_checked, warning_level, status) VALUES (?,?,?,?,?)"
    );
    let res = lp_watcher.run(poolId, source, 0, 0, 1);

    if (res.lastInsertRowid > 0) {
        console.log("Pool watcher added");
    } else {
        console.log("Error adding pool watcher");
    }
}

function removePoolWatcher(poolId) {
    let lp_watcher = db.prepare(
        "DELETE FROM lp_watcher WHERE id =?"
    );
    let res = lp_watcher.run(poolId);
    // console.debug(res);
    
    console.log("Pool watcher removed");
}

function getPoolWatcher(poolId) {
    let lp_watcher = db.query(
        "SELECT * FROM lp_watcher WHERE id =?"
    );
    let res = lp_watcher.get(poolId);
    if (res) {
        return res;
    } else {
        return false;
    }
}

function getPoolWatchers() {
    let lp_watcher = db.query(
        "SELECT * FROM lp_watcher WHERE status = 1 ORDER BY id ASC"
    );
    let res = lp_watcher.all();
    console.debug(res);
    if (res) {
        return res;
    } else {
        return false;
    }
}

async function getData(tokenID, isGetFee = false){

    const FactoryContract = new ethers.Contract(factory, IUniswapV3FactoryABI, provider);

    const NFTContract =  new ethers.Contract(NFTmanager, IUniswapV3NFTmanagerABI, provider);
    const position = await NFTContract.positions(tokenID);
    
    const token0contract =  new ethers.Contract(position.token0, ERC20, provider);
    const token1contract =  new ethers.Contract(position.token1, ERC20, provider);
    const token0Decimal = await token0contract.decimals();
    const token1Decimal = await token1contract.decimals();
    
    const token0sym = await token0contract.symbol();
    const token1sym = await token1contract.symbol();
    
    const V3pool = await FactoryContract.getPool(position.token0, position.token1, position.fee);
    const poolContract = new ethers.Contract(V3pool, IUniswapV3PoolABI, provider);

    const slot0 = await poolContract.slot0();

    // fee
    let token0Fees = 0;
    let token1Fees = 0;
    if (isGetFee) {
        const encoded = {
            tokenId: tokenID,
            recipient: '0x0000000000000000000000000000000000000000',
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128,
        };
        const tx = await NFTContract.callStatic.collect(encoded);
        token0Fees = _format_units(tx[0], token0Decimal);
        token1Fees = _format_units(tx[1], token1Decimal);
    }

    const pairName = token0sym +"/"+ token1sym;
    
    const dict = {"SqrtX96" : slot0.sqrtPriceX96.toString(), "Pair": pairName, "T0d": token0Decimal, "T1d": token1Decimal, "T0f": token0Fees, "T1F": token1Fees, "tickLow": position.tickLower, "tickHigh": position.tickUpper, "liquidity": position.liquidity.toString()}

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

async function start(positionID){
    let data = await getData(positionID, true);
    console.log(data);
    let tokens = await getTokenAmounts(data.liquidity, data.SqrtX96, data.tickLow, data.tickHigh, data.T0d, data.T1d);

    let amount0Human = _format_units(tokens[0], data.T0d);
    let amount1Human = _format_units(tokens[1], data.T1d);

    console.log(data.Pair + ": "+amount0Human+"|"+amount1Human);
}


// Notifier.notify('Hello World', 'This is my first notification using NodeJS');

// addPoolWatcher(POOL_ID);
// getPoolWatchers();
start(POOL_ID)
// Also it can be used without the position data if you pull the data it will work for any range
// getTokenAmounts(12558033400096537032, 20259533801624375790673555415)
