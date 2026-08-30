import test from 'node:test'
import assert from 'node:assert/strict'
import { dsbAppliedUrlForTitle, exactTitleJobHref } from './jobindex-retrieval-fallbacks.js'

test('DSV exact-title match treats typographic dash and ASCII hyphen as the same title punctuation',()=>{
  const jobindexTitle='Senior Project Manager – join our Group Property Transaction team'
  const html='<a class="jobTitle-link" href="/job/Hedehusene-Senior-Project-Manager-join-our-Group-Property-Transaction-team-84-2640/1429452533/">Senior Project Manager - join our Group Property Transaction team</a>'
  const url=exactTitleJobHref(html,jobindexTitle,'https://jobs.dsv.com/')
  assert.equal(url,'https://jobs.dsv.com/job/Hedehusene-Senior-Project-Manager-join-our-Group-Property-Transaction-team-84-2640/1429452533/')
})

test('DSB resolver reads appliedUrl from the escaped serialized jobs payload used by the live page',()=>{
  const title='IT Service Delivery Manager med ansvar for leverandørstyring og stabile IT-services'
  const expected='https://dsb.jobs.hr.cloud.sap/job/H%C3%B8je-Taastrup-IT-Service-Delivery-Manager-med-ansvar-for-leverand%C3%B8rstyring-og-stabile-IT-services-2630/1426908133/?feedId=453133&utm_source=LILimitedListings'
  const html=`<script>self.__next_f.push([1,"[{\\\"id\\\":\\\"$undefined\\\",\\\"title\\\":\\\"${title}\\\",\\\"location\\\":\\\"Høje Taastrup\\\",\\\"appliedUrl\\\":\\\"https://dsb.jobs.hr.cloud.sap/job/H%C3%B8je-Taastrup-IT-Service-Delivery-Manager-med-ansvar-for-leverand%C3%B8rstyring-og-stabile-IT-services-2630/1426908133/?feedId=453133\\\\u0026utm_source=LILimitedListings\\\"}]"])</script>`
  assert.equal(dsbAppliedUrlForTitle(html,title),expected)
})
