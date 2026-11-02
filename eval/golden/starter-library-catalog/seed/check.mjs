import test from 'node:test';import assert from 'node:assert/strict';import {createLibrary} from './src/library.mjs';
test('borrow and return a catalog book',()=>{const l=createLibrary([{id:'book',title:'Book',copies:1}]);const loan=l.borrow('reader','book');assert.equal(l.list()[0].available,0);l.returnLoan('reader',loan.id);assert.equal(l.list()[0].available,1);});
