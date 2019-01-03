# GoatClash Solidity smart contracts

GOAT Clash dApp Solidity smart contracts

https://clash.goat.cash

https://goat.cash


## Installing

```
npm install -g truffle
npm install
```

## Building Smart Contracts

Compile and deploy contracts to local net:

```
truffle compile
truffle migrate [--reset]
```

_`--reset` redeploys and overwrites existing contracts_

### Testing contracts

Start local Ganache node

```
truffle test
```

### Migrate 

Start local node and unlock deployment address:

```
truffle migrate --network ropsten
```
