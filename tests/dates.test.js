import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validDate, overdue } from '../src/state/model.js'
test('calendar validation rejects impossible dates and overdue ignores completed tasks', () => {
  assert.equal(validDate('2026-02-31'),false)
  assert.equal(validDate('2028-02-29'),true)
  assert.equal(overdue({due:'2000-01-01',status:'Completed'}),false)
  assert.equal(overdue({due:'2000-01-01',status:'In progress'}),true)
})
