const express = require('express');
const Web3 = require("web3");
const bodyParser = require('body-parser');
const {
    Telegraf,
    Markup,
    Extra
} = require('telegraf');
const cp = require('child_process');

let bsc_child = cp.fork('./workerbsc');

let context = null;

const app = express();

const router = express.Router();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

const bot = new Telegraf(process.env.BOT_KEY);


function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

router.get('/', (req, res)=> {

    res.json({
        'name': 'Barry'
    });
});



router.post('/update', (req, res)=> {

    bot.handleUpdate(req.body, res);
    res.send("done");
});


router.get('/sethook', (req, res)=> {
    bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}update`);
    res.send("Done setting webhook")
});

router.post('/coininfo', (req, res)=> {

    //console.log(req.body);
    res.send('ok');
});

app.use(router);


//Handlers
bot.command('start', (ctx) => ctx.reply('Hello there, welcome to Mute DAO honeypot checker.'));

bot.on('text', async (ctx)=> {
    context = ctx;
    let bsc_status = -1;
    let eth_status = -1;
    let message = ctx.update.message;
    let text = message.text.trim();

    await fetch(`https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot?chain=bsc2&token=${text}`).then(res=>bsc_status = res.status).catch(err=>console.log(err));

    await fetch(`https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot?chain=eth&token=${text}`).then(res=>eth_status = res.status).catch(err=>console.log(err));

    console.log('status:', bsc_status, eth_status);

    if (bsc_status !== 200 && eth_status !== 200) {

        ctx.reply('Honeypot chacker was unable to verify the result for the specified address. Reason might be as a result of an invalid address or the token exist on a different chain.', {
            reply_to_message_id: message.message_id
        });

    } else {

        let chain = bsc_status == 200?'bsc': 'eth';

        let data = JSON.stringify({
            address: text,
            chatId: message.chat.id,
            msgId: message.message_id,
            chain
        });

        bsc_child.send(data);

    }

});



//
bsc_child.on('message', (d)=> {
    let HONEYPOT = 1;
    let STAT = 2;
    let UNABLE = 3;
    let data = JSON.parse(d);
    let msg = '';

    if (data.status == HONEYPOT) {
        no_liquidity_msg = '\n<b>INFO!</b> There is no liquidity with BNB. Honeypot added liquidity for test - it may be that honeypot simply failed to add liquidity rather than it being a honeypot. Results with non-BNB pair may differ. If the token is not live yet, results may be different once the token is live. It is common for tokens to have 0% taxes before launching on DEX!\n'

        msg = `❌ <b>Yup, honeypot. Run the fuck away.</b>
        ❌
${data.noLiq == undefined?'': no_liquidity_msg}
<b>Token Name:</b> ${data.tokenName} (${data.tokenSymbol})
<b>Chain:</b> ${data.chain === 'bsc'?'Binance Smart Chain': 'Ethereum'}

<b>Error:</b> ${data.error}`
    } else if (data.status == STAT) {
        let buyGas = '';
        let sellGas = '';
        let maxInfo = null;
        let no_liquidity_msg = '\n<b>INFO!</b> There is no liquidity with BNB. Honeypot added liquidity for test. Results with non-BNB pair may differ. If the token is not live yet, results may be different once the token is live. It is common for tokens to have 0% taxes before launching on DEX\n';

        if (data.buyGas !== undefined) {
            buyGas = numberWithCommas(data.buyGas);
            sellGas = numberWithCommas(data.sellGas);


                if (data.maxInfo !== undefined) {
                    maxInfo = data.maxInfo.split(':');
                    maxInfo = `\n<b>${maxInfo[0]}:</b>${maxInfo[1]}\n`;
                }


                msg = `✅<b>Does not seem like a honeypot.</b>✅
<i>This can always change! Do your own due dilligence</i>
                ${data.noLiq == undefined?'': no_liquidity_msg}

 <b>Token Name</b>: ${data.tokenName} (${data.tokenSymbol})
 <b>Chain</b>: ${data.chain === 'bsc'?'Binance Smart Chain': 'Ethereum'}
                ${data.maxInfo==undefined?'':maxInfo}
<b>Gas used for Buying:</b> ${buyGas}
<b>Gas used for Selling:</b> ${sellGas}

<b>Buy Tax:</b> ${data.buyTax}%
<b>Sell Tax</b> ${data.sellTax}%`
            } else {
                msg = `❔<b>UNKNOWN</b>❔
<b>Token Name:</b> ${data.tokenName} (${data.tokenSymbol})
<b>Chain</b>: ${data.chain === 'bsc'?'Binance Smart Chain': 'Ethereum'}

<b>INFO:</b> Unable to perform checks due to vesting schedule/sell limit.`

            }
        } else {
            msg = `The honeypot checker was unable to determine the result for the specified address. Possible reason might be that there is no liquidity paired with BNB on PancakeSwap

<b>Token Name</b>: ${data.tokenName} (${data.tokenSymbol})
<b>Chain</b>: ${data.chain === 'bsc'?'Binance Smart Chain': 'Ethereum'}

${data.error}`

        }


        let scan_url = data.chain !== 'bsc'?`https://etherscan.io/token/${data.address}`: `https://bscscan.com/token/${data.address}`
        let chart_url = data.chain !== 'bsc'? `https://www.dextools.io/app/ether/pair-explorer/${data.address}`: `https://apespace.io/bsc/${data.address}?ref=honey`;
        
        let button = [{text:`📝${data.chain=='bsc'?'BscScan':'EtherScan'}`, url:scan_url}, {text:'📈Chart', url:chart_url}]

     /*
        bot.telegram.sendMessage(data.chatId, msg, {
            parse_mode: 'HTML',
            reply_to_message_id: data.msgId,
            reply_markup: Markup.inlineKeyboard([Markup.button.url('ajjjs', 'https://ajkk.com')])
        });
        */
        context.replyWithHTML(msg, Markup.inlineKeyboard([Markup.button.url(`📝${data.chain=='bsc'?'BscScan':'EtherScan'}`, scan_url), Markup.button.url('📈Chart', chart_url)]), {
            reply_to_message_id:data.msgId
        });

    });

    app.listen(process.env.PORT || 3000,
        () => console.log("Server is running..."));