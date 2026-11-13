const test=require('node:test');
const assert=require('node:assert/strict');
const {pairFiles}=require('../batch-import.js');

test('pairs each audio lesson with its own bilingual subtitle and reports missing captions',()=>{
  const files=[{name:'1. Elementary - Difficult Customer.mp3'},{name:'1. Elementary - Difficult Customer.srt'},{name:'2. Calling In Sick.mp3'},{name:'notes.txt'}];
  const result=pairFiles(files);
  assert.equal(result.pairs.length,1);
  assert.equal(result.pairs[0].subtitle.name,'1. Elementary - Difficult Customer.srt');
  assert.deepEqual(result.unmatched,['2. Calling In Sick.mp3']);
});

