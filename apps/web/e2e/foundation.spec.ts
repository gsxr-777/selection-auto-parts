import {test,expect} from '@playwright/test';
test('deterministic root, locale query preservation, theme persistence and empty catalog',async({page})=>{
  await page.goto('/');await expect(page).toHaveURL(/\/ru$/);await expect(page.getByRole('heading',{level:1})).toHaveText('Ваш автомобиль. Его запчасти.');
  await page.goto('/ru?makeId=source-1');await page.getByRole('button',{name:'Сменить язык'}).click();await expect(page).toHaveURL(/\/en\?makeId=source-1$/);await expect(page.getByRole('heading',{level:1})).toHaveText('Your vehicle. Its parts.');
  await page.getByRole('button',{name:'Toggle theme'}).click();const theme=await page.locator('html').getAttribute('data-theme');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',theme!);await expect(page.getByText('Ready for catalog data',{exact:true})).toBeVisible();
});
test('source-backed test fixture favorites persist, switch locale and synchronize tabs',async({page,context})=>{
  await context.route('**/api/v1/vehicles/models?*',route=>route.fulfill({json:{status:'ready',data:[{id:'test-model',sourceId:'fixture-only',makeId:'test-make',label:'Test model'}]}}));
  await page.goto('/en');await page.getByRole('button',{name:'Save model',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'Remove from favorites',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Change language'}).click();await expect(page).toHaveURL(/\/ru$/);await expect(page.getByRole('button',{name:'Удалить из избранного',exact:true}).first()).toBeVisible();
  const second=await context.newPage();await second.goto('/en');await second.getByRole('region',{name:'Favorites',exact:true}).getByRole('button',{name:'Remove from favorites',exact:true}).click();await expect(page.getByText('Пока нет избранных моделей',{exact:true})).toBeVisible();
});
test('corrupted and blocked storage recover safely on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>{localStorage.setItem('selection-auto-parts:favorite-models:v1','invalid');});await page.goto('/en');await expect(page.getByText('No favorite models yet',{exact:true})).toBeVisible();
  await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw new DOMException('Blocked','SecurityError');}});});await page.reload();await expect(page.getByRole('alert').filter({hasText:'Your browser cannot save favorites'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
