//
// GoatClash Solidity contract unit tests
// Version 1.0
// The Goat Herd @ https://goat.cash
// 
const GoatCash = artifacts.require("GoatCash"); // Any ERC20 standard contract with the owner initially holding all tokens
const GoatClash = artifacts.require("GoatClash");
const EVMRevert = 'revert';
const BigNumber = web3.BigNumber;
const Web3Utils = require('web3-utils');
const EthjsUtil = require('ethereumjs-util');
const getTxReceipt = require('../getTransactionReceiptMined');

const should = require('chai')
	.use(require('chai-as-promised'))
	.use(require('chai-bignumber')(BigNumber))
	.should();

contract('GoatClash', function(accounts) {
	const owner = accounts[0];
	const playerAccount = accounts[1];
	const croupierAccount = accounts[2];
	const secretSigner = accounts[3];
	const maxBet = new BigNumber(10000 * (10 ** 18));
	const contractBalance = maxBet.mul(10);
	const jackpotSize = new BigNumber(1000 * (10 ** 18));
	const betSize = new BigNumber(1000 * (10 ** 18));
	const largeBetSize = new BigNumber(5000 * (10 ** 18));
	const reward = 1.96;
	const mask = 1;
	const modulo = 2;
	
	web3.eth.getTxReceipt = getTxReceipt;

	// Local Ganache private key for secretSigner account
	const privateKey = "a3abc3cdad875e86ca60dfff15cc889c5817db86489f7d4ed3ffd3f9b7a80b71";

	beforeEach(async function() {
		this.token = await GoatCash.new({ from: owner });
		this.clash = await GoatClash.new({ from: owner });		
	});

	describe('contract defaults', function() {
		it('maxProfit 0', async function() {
			var maxProfit = await this.clash.maxProfit.call();
			maxProfit.should.be.bignumber.equal(0);
		});

		it('contract balance 0', async function() {
			var balance = await this.token.balanceOf(this.clash.address);
			balance.should.be.bignumber.equal(0);
		});

		it('jackpotSize 0', async function() {
			var jackpotSize = await this.clash.jackpotSize.call();
			jackpotSize.should.be.bignumber.equal(0);
		});
	});

	describe('contract admin', function() {
		it('sets a maximum bet of ' + maxBet, async function() {
			await this.clash.setMaxProfit(maxBet, { from: owner });

			var maxProfit = await this.clash.maxProfit.call();
			maxProfit.should.be.bignumber.equal(maxBet);
		});

		it(`can be topped up with ${contractBalance} GOAT`, async function() {
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });

			var balance = await this.token.balanceOf(this.clash.address);
			balance.should.be.bignumber.equal(contractBalance);
		});

		it('can increase jackpot by ' + jackpotSize, async function() {
			await this.clash.setToken(this.token.address);

			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			
			await this.clash.increaseJackpot(jackpotSize, { from: owner });

			var jackpot = await this.clash.jackpotSize.call();
			jackpot.should.be.bignumber.equal(jackpotSize);
		});
		
		it(`owner can set ERC20 contract to use`, async function() {
			await this.clash.setToken(this.token.address);

			var erc20 = await this.clash.token.call();
			erc20.should.be.equal(this.token.address);
		});

		it(`non-owner can't set ERC20 contract to use`, async function() {
			await this.clash.setToken(this.token.address, {from: playerAccount})
				.should.be.rejectedWith(EVMRevert);

			var erc20 = await this.clash.token.call();
			erc20.should.not.be.equal(this.token.address);
		});
		
		it(`owner can withdraw funds`, async function() {
			await this.clash.setToken(this.token.address);
			
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			
			await this.clash.withdrawFunds(playerAccount, maxBet);

			var balanceAfter = await this.token.balanceOf(this.clash.address);
			balanceAfter.should.be.bignumber.equal(contractBalance.sub(maxBet));

			var accountBalance = await this.token.balanceOf(playerAccount);
			accountBalance.should.be.bignumber.equal(maxBet);
		})

		it(`non-owner can't withdraw funds`, async function() {
			await this.clash.setToken(this.token.address);
			
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			
			await this.clash.withdrawFunds(playerAccount, maxBet, {from: playerAccount})
				.should.be.rejectedWith(EVMRevert);

			var balanceAfter = await this.token.balanceOf(this.clash.address);
			balanceAfter.should.be.bignumber.equal(contractBalance);
		})
				
		it(`owner can set croupier address`, async function() {
			await this.clash.setCroupier(croupierAccount);

			var address = await this.clash.croupier.call();
			address.should.be.equal(croupierAccount);
		});

		it(`non-owner can't set croupier address`, async function() {
			await this.clash.setCroupier(playerAccount, {from: playerAccount})
				.should.be.rejectedWith(EVMRevert);

			var address = await this.clash.croupier.call();
			address.should.not.be.equal(playerAccount);
		});
		// Skipping tests for setSecretSigner as they are identical				
	});
	
	describe('contract destruction', function() {
		it('cannot be killed by non-owner', async function() {
			await this.clash.kill({ from: playerAccount }).should.be.rejectedWith(EVMRevert);
		});

		it('can be killed by owner', async function() {
			await this.clash.setToken(this.token.address);
			var ownerBalanceBefore = await this.token.balanceOf(owner);
			
			// Lock funds in jackpot before killing
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			await this.clash.increaseJackpot(jackpotSize, { from: owner });

			var balanceBefore = await this.token.balanceOf(this.clash.address);			
			balanceBefore.should.be.bignumber.equal(contractBalance, "Account has balance before kill");

			// Kill the contract
			let tx = await this.clash.kill.sendTransaction({ from: owner });

			// Monitor tx
			let receipt = await web3.eth.getTxReceipt(tx);
			receipt.status.should.be.equal('0x1');

			var balanceAfter = await this.token.balanceOf(this.clash.address);
			var ownerBalanceAfter = await this.token.balanceOf(owner);
			balanceAfter.should.be.bignumber.equal(0, 'Kill function should transfer all remaining coins');
			ownerBalanceAfter.should.be.bignumber.equal(ownerBalanceBefore, 'Remaining coins should be in owner account.');
			
			await this.clash.croupier.call().should.be.rejected;
		});
	});

	function generateRevealSecret() {
		let commitLastBlock = web3.eth.blockNumber + 1,
		reveal = Web3Utils.randomHex(32);

		commitLastBlock = Web3Utils.numberToHex(commitLastBlock);
			
		// Hash the 'reveal' secret
		let revealHash = Web3Utils.soliditySha3(Web3Utils.hexToNumberString(reveal));
		
		// SHA3 / Keccak256 sign the string in solidity format
		let message = Web3Utils.padLeft(commitLastBlock, 10).concat(revealHash.replace('0x',''));
		let signatureHash = EthjsUtil.keccak256(message);

		// Sign the commit with secretSigner's private key
		var signature = EthjsUtil.ecsign(signatureHash, new Buffer(privateKey, 'hex')); 

		// Guarantee v == 27
		if (signature.v !== 27) return generateRevealSecret();

		return { reveal, revealHash, signature, signatureHash, commitLastBlock }
	}

	describe('betting logic', function() {
		it('can sign reveal secret', async function() {			
			// Setup contract first
			await this.clash.setToken(this.token.address);
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			await this.clash.setCroupier(croupierAccount);
			await this.clash.setSecretSigner(secretSigner);
			await this.clash.setMaxProfit(maxBet, { from: owner });
		 
			// Setup bet
			let { reveal, revealHash, signature, signatureHash, commitLastBlock } = generateRevealSecret();

			// Test recovering secretSigner's address 
			var secretSignKey = EthjsUtil.ecrecover(signatureHash, 27, signature.r, signature.s);
			let address = EthjsUtil.bufferToHex(EthjsUtil.pubToAddress(secretSignKey));
			address.should.equal(secretSigner);			
		})

		it('player can insert coin', async function() {
			await this.clash.setToken(this.token.address);

			//await this.clash.insertCoin(betSize);
			await this.token.increaseApproval(this.clash.address, betSize);

			let allowance = await this.token.allowance(owner, this.clash.address);
			allowance.should.be.bignumber.equal(betSize);
		})

		it('can place a small bet', async function() {
			// Setup contract first
			await this.clash.setToken(this.token.address);
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			await this.clash.setCroupier(croupierAccount);
			await this.clash.setSecretSigner(secretSigner);
			await this.clash.setMaxProfit(maxBet, { from: owner });		
			
			// Insert coins for bet
			await this.token.increaseApproval(this.clash.address, betSize);
			
			// Setup bet
			let { reveal, revealHash, signature, signatureHash, commitLastBlock } = generateRevealSecret();

			// Convert input types
			let commit = revealHash, 
				r = EthjsUtil.bufferToHex(signature.r),
				s = EthjsUtil.bufferToHex(signature.s);
				
			// Place bet
			var result = await this.clash.placeBet(betSize, mask, modulo, commitLastBlock, commit, r, s);

			should.exist(result.logs);

			var lockedInBets = await this.clash.lockedInBets.call();
			lockedInBets.should.be.bignumber.equal(betSize * reward);
			
			var jackpotSize = await this.clash.jackpotSize.call();
			jackpotSize.should.be.bignumber.equal(0);
		})
		
		it('can place a bet eligible for jackpot', async function() {
			// Setup contract first
			await this.clash.setToken(this.token.address);
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			await this.clash.setCroupier(croupierAccount);
			await this.clash.setSecretSigner(secretSigner);
			await this.clash.setMaxProfit(maxBet, { from: owner });		
			
			// Insert coins for bet
			await this.token.increaseApproval(this.clash.address, largeBetSize);
			
			// Setup bet
			let { reveal, revealHash, signature, signatureHash, commitLastBlock } = generateRevealSecret();

			// Convert input types
			let commit = revealHash, 
				r = EthjsUtil.bufferToHex(signature.r),
				s = EthjsUtil.bufferToHex(signature.s);

			// Place bet
			var { logs } = await this.clash.placeBet(largeBetSize, mask, modulo, commitLastBlock, commit, r, s);

			should.exist(logs);

			var lockedInBets = await this.clash.lockedInBets.call();
			lockedInBets.should.be.bignumber.above(largeBetSize);

			var jackpotSize = await this.clash.jackpotSize.call();
			jackpotSize.should.be.bignumber.above(0, 'Jackpot size should increase after bet.');
		})

		async function settleBet() {		
			// Setup contract first
			await this.clash.setToken(this.token.address);
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			await this.token.transfer(playerAccount, betSize, { from: owner });
			await this.clash.setCroupier(croupierAccount);
			await this.clash.setSecretSigner(secretSigner);
			await this.clash.setMaxProfit(maxBet, { from: owner });		

			// Insert coins for bet
			await this.token.increaseApproval(this.clash.address, betSize, { from: playerAccount });

			// Setup bet
			let { reveal, revealHash, signature, signatureHash, commitLastBlock } = generateRevealSecret();

			// Convert input types
			let commit = revealHash, 
				r = EthjsUtil.bufferToHex(signature.r),
				s = EthjsUtil.bufferToHex(signature.s);
			
				
			let accountBalanceBefore = await this.token.balanceOf(playerAccount);
			accountBalanceBefore.should.be.bignumber.equal(betSize);

			let allowanceBefore = await this.token.allowance(playerAccount, this.clash.address);

			// Place bet
			let tx = await this.clash.placeBet.sendTransaction(betSize, mask, modulo, commitLastBlock, commit, r, s, { from: playerAccount });

			// Monitor tx
			web3.eth.getTxReceipt = getTxReceipt;
			let receipt = await web3.eth.getTxReceipt(tx);

			receipt.status.should.be.equal('0x1');

			let lockedInBets = await this.clash.lockedInBets.call();
			lockedInBets.should.be.bignumber.equal(betSize * reward);

			// Settle bet
			let blockHash = web3.eth.getBlock(commitLastBlock).hash;			
			let { logs } = await this.clash.settleBet(reveal, blockHash, { from: croupierAccount });
			
			const paymentEvent = logs.find(e => e.event === 'Payment' && e.args.beneficiary === playerAccount);

			let win = paymentEvent ? paymentEvent.args.amount.gt(0) : false;

			let lockedInBetsAfter = await this.clash.lockedInBets.call();
			lockedInBetsAfter.should.be.bignumber.equal(0);
			
			let accountBalanceAfter = await this.token.balanceOf(playerAccount);
			
			let allowance = await this.token.allowance(playerAccount, this.clash.address);

			if (win) {
				accountBalanceAfter.should.be.bignumber.equal(accountBalanceBefore.add(betSize.mul(reward).sub(betSize)));
				allowance.should.be.bignumber.equal(betSize);
			}
			else {
				accountBalanceAfter.should.be.bignumber.equal(accountBalanceBefore.sub(betSize));
			
				// Check credit deducted only on loss
				allowance.should.be.bignumber.equal(0);
			}			
		}

		it('can settle a bet', async function() {
			// Call place and settle bet a few times to try to test win & loss
			await settleBet.call(this);
		})

		it('it can cancel a bet', async function() {
			// Setup contract first
			await this.clash.setToken(this.token.address);
			await this.token.transfer(this.clash.address, contractBalance, { from: owner });
			await this.token.transfer(playerAccount, betSize, { from: owner });
			await this.clash.setCroupier(croupierAccount);
			await this.clash.setSecretSigner(secretSigner);
			await this.clash.setMaxProfit(maxBet, { from: owner });		

			// Insert coins for bet
			await this.token.increaseApproval(this.clash.address, betSize, { from: playerAccount });

			// Setup bet
			let { reveal, revealHash, signature, signatureHash, commitLastBlock } = generateRevealSecret();

			// Convert input types
			let commit = revealHash, 
				r = EthjsUtil.bufferToHex(signature.r),
				s = EthjsUtil.bufferToHex(signature.s);
				
			// Place bet
			var result = await this.clash.placeBet(betSize, mask, modulo, commitLastBlock, commit, r, s, { from: playerAccount });

			should.exist(result.logs);

			var lockedInBets = await this.clash.lockedInBets.call();
			lockedInBets.should.be.bignumber.equal(betSize * reward);

			// Cancel bet
			await this.clash.cancelBet(commit, { from: croupierAccount });
			
			var lockedInBetsAfter = await this.clash.lockedInBets.call();
			lockedInBetsAfter.should.be.bignumber.equal(0, 'Locked in bets reduced after cancel');

			var accountBalanceAfter = await this.token.balanceOf(playerAccount);
			accountBalanceAfter.should.be.bignumber.equal(betSize);

			let allowance = await this.token.allowance(playerAccount, this.clash.address);
			allowance.should.be.bignumber.equal(betSize, 'Credit not reduced after cancel');
		})
	});
});

