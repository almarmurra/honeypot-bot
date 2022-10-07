const Web3 = require("web3");

const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

let web3 = null;
let tokenName = '';
let tokenSymbol = '';
let tokenDecimals = 0;
let maxSell = 0;
let maxTXAmount = 0;
let bnbIN = 1000000000000000000;
let maxTxBNB = null;
let address = '';
let addressToOutput = '';
let chain = '';


function encodeBasicFunction(web3, funcName) {
    return web3.eth.abi.encodeFunctionCall({
        name: funcName,
        type: 'function',
        inputs: []
    }, []);
}

async function updateTokenInformation(web3, tokenAddress) {
    web3.eth.call({
        to: tokenAddress,
        value: 0,
        gas: 150000,
        data: encodeBasicFunction(web3, 'name'),
    })
    .then(value => {
        tokenName = web3.eth.abi.decodeParameter('string', value);
    });

    web3.eth.call({
        to: tokenAddress,
        value: 0,
        gas: 150000,
        data: encodeBasicFunction(web3, 'symbol'),
    })
    .then(value => {
        tokenSymbol = web3.eth.abi.decodeParameter('string', value);

    });
}

async function run(data) {
    address = data.address;
    x = updateTokenInformation(web3, address);
    await getMaxes();
    if (maxTXAmount != 0 || maxSell != 0) {
        await getDecimals(address);
        await getBNBIn(address);
    }
    await honeypotIs(data);
    await x;
}

async function getDecimals(address) {
    let sig = encodeBasicFunction(web3, 'decimals');
    d = {
        to: address,
        from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
        value: 0,
        gas: 15000000,
        data: sig,
    };
    try {
        let val = await web3.eth.call(d);
        tokenDecimals = web3.utils.hexToNumber(val);
    }catch (e) {
        console.log('decimals', e);
    }
}

async function getBNBIn(address) {
    let amountIn = maxTXAmount;
    if (maxSell != 0) {
        amountIn = maxSell;
    }
    let WETH = chain==='bsc'?'0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c':'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    let path = [address,
        WETH];
    let sig = web3.eth.abi.encodeFunctionCall({
        name: 'getAmountsOut',
        type: 'function',
        inputs: [{
            type: 'uint256', name: 'amountIn'
        },
            {
                type: 'address[]', name: 'path'
            },
        ],
        outputs: [{
            type: 'uint256[]', name: 'amounts'
        },
        ],
    }, [amountIn, path]);

    d = {
        to: chain==='bsc'?'0x10ED43C718714eb63d5aA57B78B54704E256024E':'0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
        from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
        value: 0,
        gas: 15000000,
        data: sig,
    };
    try {
        let val = await web3.eth.call(d);
        let decoded = web3.eth.abi.decodeParameter('uint256[]', val);
        bnbIN = web3.utils.toBN(decoded[1]);
        maxTxBNB = bnbIN;
    } catch (e) {
        console.log(e);
    }
    console.log(bnbIN, amountIn);
}

async function getMaxes() {
    let sig = web3.eth.abi.encodeFunctionSignature({
        name: '_maxTxAmount', type: 'function', inputs: []});
    d = {
        to: address,
        from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
        value: 0,
        gas: 15000000,
        data: sig,
    };
    try {
        let val = await web3.eth.call(d);
        maxTXAmount = web3.utils.toBN(val);
        console.log(val, maxTXAmount);
    } catch (e) {
        console.log('_maxTxAmount: ', e);
        // I will nest as much as I want. screw javascript.
        sig = web3.eth.abi.encodeFunctionSignature({
            name: 'maxSellTransactionAmount', type: 'function', inputs: []});
        d = {
            to: address,
            from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
            value: 0,
            gas: 15000000,
            data: sig,
        };
        try {
            let val2 = await web3.eth.call(d);
            maxSell = web3.utils.toBN(val2);
            console.log(val2, maxSell);
        } catch (e) {}
    }
}



async function honeypotIs(data) {
    let address = data.address;

    var xhr = new XMLHttpRequest();
    xhr.open('GET',`https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot?chain=${data.chain}${data.chain==='bsc'?2:''}&token=${address}`, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
        var status = xhr.status;
        if (status === 200) {
            let response = JSON.parse(xhr.responseText);
            response.chatId = data.chatId;
            response.msgId = data.msgId;
            response.address = address;
            if (response.IsHoneypot == false) {
                showStats(response);
            } else {

                if (response.Error.includes('INSUFFICIENT_LIQUIDITY')) {
                    showUnable(response);
                    return;
                }
                showHoneypot(response);
            }
        }
    };
    xhr.send();

    updateTokenInformation(web3, address);

}

async function showStats(resp) {

    let warnings = [];
    let data = {
        tokenSymbol,
        tokenName,
        chain,
        status: 2,
        msgId: resp.msgId,
        address: resp.address,
        chatId: resp.chatId,
        buyGas: resp.BuyGas,
        sellGas: resp.SellGas,
        buyTax: resp.BuyTax,
        sellTax: resp.SellTax
    };

    if (resp.BuyTax + resp.SellTax >= 80) {
        warnings.push("Insanely high tax. Effectively a honeypot.");
    } else if (resp.BuyTax + resp.SellTax >= 30) {
        warnings.push("Be aware of high tax.");
    }
    if (resp.SellGas >= 3500000) {
        warnings.push("Selling the token has high gas cost. Be aware.");
    }


    if (warnings.length > 0) {
        data.warnings = warnings;
    }


    if (maxTXAmount != 0 || maxSell != 0) {
        console.log('maxes', maxTXAmount.toString(), maxSell);
        let n = 'Max TX';
        let x = maxTXAmount;
        if (maxSell != 0) {
            n = 'Max Sell';
            x = maxSell;
        }
        let bnbWorth = '?'
        if (maxTxBNB != null) {
            bnbWorth = Math.round(maxTxBNB / 10**15) / 10**3;
        }
        let tokens = Math.round(x / 10**tokenDecimals);
        data.maxInfo = `${n}: ${tokens} ${tokenSymbol} (~${bnbWorth} BNB)`;
    }

    if (resp.NoLiquidity == true) {
        data.noLiq = true;
    }


    process.send(JSON.stringify(data));
    console.log("Does not appear to be a honeypot");
}


async function showHoneypot(resp) {
    let data = {
        tokenSymbol,
        tokenName,
        status: 1,
        chain,
        msgId: resp.msgId,
        chatId: resp.chatId,
        address: resp.address,
        error: resp.Error
    };

    if (resp.NoLiquidity == true) {
        data.noLiq = true;
    }

    process.send(JSON.stringify(data));
    console.log('yop honey pot!');
}

async function showUnable(resp) {
    let data = {
        tokenName,
        tokenSymbol,
        address: resp.address,
        msgId: resp.msgId,
        chatId: resp.chatId,
        error: resp.Error
    };
    
    process.send(JSON.stringify(data));
    console.log('Unable to get honeypot');
}


process.on('message', async (d)=> {
    console.log("Received", d);
    let data = JSON.parse(d);
    
    web3 = new Web3(data.chain==='bsc'?'https://bsc-dataseed.binance.org/':'https://cloudflare-eth.com/');
    await run(data);

});