# Uniswap Liquidity Pool (LP) Watcher

Pull the balance of Token A and Token B in your Uniswap V3 Liquidity Pool and alert (using telegram) if one of them is below 0 (LP is out of range).

# Running

Clone the project:

`git clone https://github.com/hiidemo/uniswap_lp.git`

Go to the project folder:

`cd uniswap_lp`

Set your environment ENDPOINT_* variable to be the HTTPS link

Configure your telegram bot token and chat id in the.env file

Install bun.sh

`Develop, test, run, and bundle JavaScript & TypeScript projects—all with Bun. Bun is an all-in-one JavaScript runtime & toolkit designed for speed, complete with a bundler, test runner, and Node.js-compatible package manager.`

Then run:
`bun main.js`

# Features
1. Using the [Uniswap SDK](https://github.com/Uniswap/uniswap-python) to pull the LP balance.
2. Using SQLite to store the LP pool ID.
3. Implement telegram bot commands to add/remove LP pools.
4. Implement an alert system (telegram) 
5. Designed as a service, multi-threaded and easily scalable
