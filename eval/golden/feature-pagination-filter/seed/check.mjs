import test from 'node:test';import assert from 'node:assert/strict';import {listTickets} from './src/tickets.mjs';
test('sort and page tickets',()=>{assert.deepEqual(listTickets([{id:5,status:'open'},{id:1,status:'closed'}],{limit:1}),{items:[{id:1,status:'closed'}],nextCursor:1});});
