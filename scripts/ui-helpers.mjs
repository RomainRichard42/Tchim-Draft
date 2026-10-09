import { expect } from '@playwright/test';

// Other UI suites acknowledge the real introduction normally; this feature has its own lifecycle suite.
export async function dismissReleaseNotes(page){
  const notes=await page.evaluate(()=>window.draftApi.releaseNotes?.());
  if(!notes?.pending)return;
  await page.getByTestId('release-notes-close').click();
  await expect(page.getByTestId('release-notes')).toHaveCount(0);
}
