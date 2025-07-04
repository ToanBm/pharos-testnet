const readline = require('readline');
const { ethers } = require('ethers');
const fs = require('fs');
const routerAbi = require('./routerAbi.json');

// ==================== CONFIG ====================
const tokens = {
    PHRS: { address: '0x76aaada469d23216be5f7c596fa25f282ff9b364', decimals: 18, isNative: true },
    USDC: { address: '0x72df0bcd7276f2dfbac900d1ce63c272c4bccced', decimals: 6, isNative: false },
    USDT: { address: '0xd4071393f8716661958f766df660033b3d35fd29', decimals: 6, isNative: false }
};

const fee = 3000;

const minTokenAmount = 0.005;
const maxTokenAmount = 0.01;
const minSwapDelay = 20000;
const maxSwapDelay = 30000;

const minSendTxPerWallet = 5;
const maxSendTxPerWallet = 10;
const minSendAmount = 0.005;
const maxSendAmount = 0.01;
const minSendDelay = 20000;
const maxSendDelay = 30000;

const WALLET_FILE = 'wallets.txt';

let wallet;
let selectedDAppName = '';
let selectedPairName = '';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ==================== COMMON FUNCTION ====================
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, ans => resolve(ans)));
}

function getRandomAmount(decimals) {
    const randomValue = Math.random() * (maxTokenAmount - minTokenAmount) + minTokenAmount;
    return ethers.parseUnits(randomValue.toFixed(3), decimals);
}

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

// ==================== SWAP FUNCTION ====================
async function autoSwap(routerContract, tokenIn, tokenOut, numberOfSwap) {
    for (let i = 0; i < numberOfSwap; i++) {
        try {
            const amountIn = getRandomAmount(tokenIn.decimals);
            const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

            const nonce = await wallet.getNonce('pending');

            const exactInputSingleCalldata = routerContract.interface.encodeFunctionData('exactInputSingle', [{
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                fee: fee,
                recipient: wallet.address,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            }]);

            const options = tokenIn.isNative ? { value: amountIn, nonce: nonce } : { nonce: nonce };

            const tx = await routerContract.multicall(deadline, [exactInputSingleCalldata], options);

            console.log(`\n#${i + 1} Swap ${selectedPairName} on ${selectedDAppName} ⏳`);
            console.log(`🔄 Submitted: ${tx.hash}`);

            try {
                await tx.wait();
                console.log(`✅ Success!`);
                console.log(`🔗 View on Explorer: https://testnet.pharosscan.xyz/tx/${tx.hash}`);
            } catch (waitError) {
                console.error('Wait Failed (Service Busy), moving to next swap.');
            }
        } catch (err) {
            console.error('❌ Swap Failed!');
        }

        const delayTime = getRandomDelay(minSwapDelay, maxSwapDelay);
        console.log(`⏳ Waiting ${delayTime / 1000}s before next swap...`);
        await new Promise(res => setTimeout(res, delayTime));
    }
}

// ==================== TRANSFER FUNCTION ====================
async function prepareAddressFile() {
    if (!fs.existsSync(WALLET_FILE)) {
        console.log(`📂 Creating address file: ${WALLET_FILE}`);
        fs.writeFileSync(WALLET_FILE, '');
    }

    console.log(`📥 Please open the file: ${WALLET_FILE}`);
    console.log('👉 Paste the recipient wallet addresses (one per line).');
    console.log('⚡️ Press Enter here when you have finished pasting the addresses...');
    await askQuestion('Press Enter to continue...');
}

async function sendNativeToken() {
    await prepareAddressFile();

    let walletList;
    try {
        walletList = fs.readFileSync(WALLET_FILE, 'utf-8').split('\n').map(addr => addr.trim()).filter(Boolean);
    } catch (err) {
        console.error('Cannot read wallets.txt file!');
        return;
    }

    for (let i = 0; i < walletList.length; i++) {
        const recipient = walletList[i];
        const txCount = Math.floor(Math.random() * (maxSendTxPerWallet - minSendTxPerWallet + 1)) + minSendTxPerWallet;

        console.log(`\n🚀 Starting transfers to ${recipient} - Total: ${txCount}`);

        for (let j = 0; j < txCount; j++) {
            try {
                const randomAmount = (Math.random() * (maxSendAmount - minSendAmount) + minSendAmount).toFixed(3);
                const amount = ethers.parseEther(randomAmount);

                const tx = await wallet.sendTransaction({
                    to: recipient,
                    value: amount
                });

                console.log(`\n#${j + 1} Transfer to ${recipient} ⏳`);
                console.log(`🚀 Submitted: ${tx.hash}`);

                await tx.wait();
                console.log(`✅ Success!`);
                console.log(`🔗 View on Explorer: https://testnet.pharosscan.xyz/tx/${tx.hash}`);
            } catch (err) {
                console.error(`❌ Transfer Failed to ${recipient}`);
            }

            const delayTime = getRandomDelay(minSendDelay, maxSendDelay);
            console.log(`⏳ Waiting ${delayTime / 1000}s before next send...`);
            await new Promise(res => setTimeout(res, delayTime));
        }

        console.log(`✅ Finished transfers to ${recipient}`);
        console.log('-----------------------------');
    }

    console.log('✅ All transfers completed!');
}

// ==================== SELECTION FUNCTION ====================
async function selectDApp() {
    console.log('\nSelect DApp:');
    console.log('1. ZenithFinance');
    console.log('2. FaroSwap');

    const choice = await askQuestion('Enter your choice (1/2): ');

    if (choice === '1') {
        selectedDAppName = 'ZenithFinance';
        return '0x276c746ae833cf98d9c20781d3a9f0c9095e788f';
    }
    if (choice === '2') {
        selectedDAppName = 'FaroSwap';
        return '0x3541423f25a1ca5c98fdbcf478405d3f0aad1164';
    }

    console.log('Invalid choice, please try again.');
    return await selectDApp();
}

async function selectSwapPair() {
    console.log('\nSelect swap pair:');
    console.log('1. PHRS → USDT');
    console.log('2. PHRS → USDC');
    console.log('3. USDC → USDT');

    const choice = await askQuestion('Enter your choice (1/2/3): ');

    if (choice === '1') {
        selectedPairName = 'PHRS → USDT';
        return { tokenIn: tokens.PHRS, tokenOut: tokens.USDT };
    }
    if (choice === '2') {
        selectedPairName = 'PHRS → USDC';
        return { tokenIn: tokens.PHRS, tokenOut: tokens.USDC };
    }
    if (choice === '3') {
        selectedPairName = 'USDC → USDT';
        return { tokenIn: tokens.USDC, tokenOut: tokens.USDT };
    }

    console.log('Invalid choice, please try again.');
    return await selectSwapPair();
}

// ==================== MAIN FUNCTION ====================
async function run() {
    const privateKey = await askQuestion('Enter your private key: ');
    wallet = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider('https://testnet.dplabs-internal.com'));

    while (true) {
        console.log('\nSelect Action:');
        console.log('1. Swap Tokens');
        console.log('2. Send Native Token');

        const action = await askQuestion('Enter your choice (1/2): ');

        if (action === '1') {
            console.log('================= SWAP TOKEN =================');
            const routerAddress = await selectDApp();
            const routerContract = new ethers.Contract(routerAddress, routerAbi, wallet);

            const { tokenIn, tokenOut } = await selectSwapPair();
            const numberOfSwap = await askQuestion('Enter number of swaps: ');

            console.log(`\nStarting swap: ${selectedPairName} on ${selectedDAppName}`);
            await autoSwap(routerContract, tokenIn, tokenOut, parseInt(numberOfSwap));
        } else if (action === '2') {
            console.log('================= SEND NATIVE TOKEN =================');
            await sendNativeToken();
        } else {
            console.log('Invalid choice, please try again.');
        }
    }
}

run();
