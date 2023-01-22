import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ethers } from 'ethers';
import sortBy from 'sort-by';

const configPath = path.join(os.homedir(), '.wallet');
if (!fs.existsSync(configPath)) {
    console.log('config file missing, please place it at:', configPath);
    process.exit();
}
const config = JSON.parse(fs.readFileSync(configPath));

const provider = new ethers.providers.AlchemyProvider('matic', config.polygon_alchemy_key);

const BLOCKS_FILENAME = path.join('data', 'volkov-1.json');
const RUNS_FILENAME = path.join('data', 'runs.json');

function readBlocksFile() {
    return JSON.parse(fs.readFileSync(BLOCKS_FILENAME));
}

function readRunsFile() {
    try {
        return JSON.parse(fs.readFileSync(RUNS_FILENAME));
    } catch (e) {
        return {};
    }
}

function writeRunsFile(runs) {
    fs.writeFileSync(RUNS_FILENAME, JSON.stringify(runs));
}

function parseAbi(filename) {
    return JSON.parse(fs.readFileSync(filename).toString());
}

const GAME_ADDRESS = '0x9d0c114Ac1C3cD1276B0366160B3354ca0f9377E';

const gameContract = new ethers.Contract(GAME_ADDRESS, parseAbi('./abi/Game.json'), provider);

function blockRange(startBlockNumber, endBlockNumber, n) {
    const pairs = [];
    for (let i=startBlockNumber; i < endBlockNumber; i += n) {
        pairs.push({
            start: i,
            end: i+n >= endBlockNumber ? endBlockNumber : i+n,
        });
    }
    return pairs;
}

async function fetchRunData(runId) {
    return gameContract.runsById(runId).then(r => {
        return {
            notorietyPoints: r.notorietyPoints?.toNumber(),
            data: parseInt(ethers.utils.formatUnits(r.data, 18)),
            startTime: r.startTime?.toNumber(),
            endTime: r.endTime?.toNumber(),
        };
    });
}

async function augmentRun(runs, { runId, tokenId, to }) {
    if (runs[runId] && runs[runId].endTime) {
        return runs[runId];
    }
    return fetchRunData(runId).then(({ notorietyPoints, data, startTime, endTime }) => {
        return {
            runId,
            to,
            runnerId: tokenId.toNumber(),
            notorietyPoints,
            data,
            startTime,
            endTime,
        };
    })
    .catch(e => {
        console.log('augment failed', runId, tokenId.toNumber(), to);
        return augmentRun({ runId, tokenId, to });
    });
}

async function getPage(runs, { start, end }) {
    return gameContract.queryFilter(gameContract.filters.RunEnded(), start, end)
        .then(page => page.map(e => e.args))
        .then(page => Promise.all(page.map(run => augmentRun(runs, run))));
}

async function getAllRuns(pairs) {
    const runs = readRunsFile();
    for (let i=0; i < pairs.length; i++) {
        const page = await getPage(runs, pairs[i]);
        page.forEach(run => {
            runs[run.runId] = run;
        });
    }
    writeRunsFile(runs);
    return runs;
}

async function main() {
    const { start, end } = readBlocksFile();
    const currentBlock = await provider.getBlock().then(b => b.number);
    const pairs = blockRange(start, end || currentBlock, 10000);
    await getAllRuns(pairs)
        .then(runs => {
            const runners = {};
            Object.values(runs).forEach(run => {
                let runner = runners[run.runnerId] || {
                    id: run.runnerId,
                    total: 0,
                    runs: 0,
                };
                runner.total += run.data;
                runner.runs++;
                runners[runner.id] = runner;
            });
            return Object.values(runners).sort(sortBy('-total'));
        }).then(runners => {
            console.log(runners.splice(0, 10));
        });
}

main();
