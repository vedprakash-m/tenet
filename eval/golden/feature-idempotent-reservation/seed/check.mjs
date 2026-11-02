import test from 'node:test';import assert from 'node:assert/strict';import {createReservations} from './src/reservations.mjs';
test('a reservation consumes stock once',()=>{const r=createReservations({book:3});const a=r.reserve('reader','book',1,'request');assert.equal(a.quantity,1);assert.equal(r.available('book'),2);});
