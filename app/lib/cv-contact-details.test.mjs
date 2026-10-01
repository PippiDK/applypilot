import test from 'node:test'
import assert from 'node:assert/strict'
import {extractCvContactDetails} from './cv-contact-details.js'

test('extracts sourced cover-letter identity and optional LinkedIn from CV text',()=>{
  const details=extractCvContactDetails(`Yulia Bjørnberg
Senior IT Project & Delivery Manager
+45 31 31 16 02
julia.bjoernberg@gmail.com
linkedin.com/in/yulia-bjornberg
Professional Summary
Senior delivery manager`)
  assert.deepEqual(details,{
    name:'Yulia Bjørnberg',
    email:'julia.bjoernberg@gmail.com',
    phone:'+45 31 31 16 02',
    linkedIn:'https://linkedin.com/in/yulia-bjornberg'
  })
})

test('omits LinkedIn when the selected CV does not contain one',()=>{
  const details=extractCvContactDetails(`Ada Example
Senior Project Manager
+45 12 34 56 78
ada@example.com
Professional Summary`)
  assert.equal(details.name,'Ada Example')
  assert.equal(details.linkedIn,'')
})
