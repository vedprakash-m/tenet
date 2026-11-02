import test from 'node:test';import assert from 'node:assert/strict';import {createAccounts} from './src/accounts.mjs';
test('an owner transfers cents',()=>{const a=createAccounts(new Map([['u',{role:'member'}]]),[{id:'a',owner:'u',cents:100},{id:'b',owner:'other',cents:0}]);a.transfer({userId:'u'},'a','b',25);assert.equal(a.balance('a'),75);assert.equal(a.balance('b'),25);});
