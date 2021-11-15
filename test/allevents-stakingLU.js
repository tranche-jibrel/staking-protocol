// const GETHURL = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`;
const GETHURL = 'https://mainnet.infura.io/v3/652c935675d646d1bb5bc5487670f96b';
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(GETHURL));

const fs = require('fs');
const contractAbi = JSON.parse(fs.readFileSync('./test/StakingWithLockup.abi', 'utf8'));

const CNTADDRESS = '0xab4235a9acf00a45557e90f7db127f3b293ca45a';

//const etherescan_url = `http://api.etherscan.io/api?module=contract&action=getabi&address=${CONTRACT_ADDRESS}&apikey=${ETHERSCAN_API_KEY}`

const cnt = new web3.eth.Contract(contractAbi, CNTADDRESS);

const timeStart = Date.now();

const getAllEvents = async() => {
    //let events = await cnt.events.allEvents('Staked', {
    let events = await cnt.getPastEvents('Staked', {
        // filter: {user: "0x85717bc8f77b7b80a204a92b9ebe6e1a34ac69ab"},
        // fromBlock: 9581896,
        // toBlock: 'latest'
    });
    /*
    let events = await cnt.getPastEvents('Reinvest', {
        filter: {user: "0x85717bc8f77b7b80a204a92b9ebe6e1a34ac69ab"},
        fromBlock: 9581896,
        toBlock: 'latest'
        });
        */
	return events;
};

getAllEvents().then(data => {
    console.log(data);
}).catch(err => {
    console.log('err :>> ', err);
});;


console.log(Date.now() - timeStart);