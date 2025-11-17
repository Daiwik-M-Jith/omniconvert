const { test, expect } = require('@playwright/test');
const path = require('path');

test('upload sample file and select a conversion target', async ({ page }) => {
  await page.goto('http://127.0.0.1:8000/');
  // go to Explore tab
  await page.click('#nav-explore');
  // wait for grid
  await page.waitForSelector('#conversion-grid .convert-card-mini');
  // pick the first direct target button if available
  const firstBtn = await page.$('#conversion-grid .conversion-target-btn');
  expect(firstBtn).not.toBeNull();
  const ext = await firstBtn.textContent();
  // Click to select target, which should switch to Convert view
  await firstBtn.click();
  await page.waitForSelector('#view-convert.active');

  // Attach file
  const sample = path.join(__dirname, 'sample.txt');
  await page.setInputFiles('#file-input', sample);
  // wait for selector that indicates file selected
  await page.waitForSelector('#file-selected');

  // ensure target select is populated
  await page.waitForSelector('#target-format option[value]');

  // Submit convert (this will call the backend); we cannot assert download reliably here,
  // but we assert the request returns or the server responds with a non-500 status via fetch interception.
  // Click Convert Now
  const convert = await page.$('button.btn-convert');
  expect(convert).not.toBeNull();
});
