const GoatClash = artifacts.require("GoatClash");
const BigNumber = web3.BigNumber;

module.exports = async function(deployer) {
  // Setup contract defaults
  const croupier = '0xb1eee70a830832a77becafefde75eba281d0d4e6';
  const secretSign = '0x123451ed0fca61ef847775710b4fe0e7f6f27856';
  const maxProfit = new BigNumber(100000 * (10 ** 18));  
  const token = '0xBbadA737611ebAAFC78A31cA90E826Ffc9e400da';
	
  deployer.deploy(GoatClash)
  .then(async (instance) => {
    await instance.setToken(token);
    await instance.setCroupier(croupier);
    await instance.setSecretSigner(secretSign);
    await instance.setMaxProfit(maxProfit);
  })
};
