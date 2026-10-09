import {test,expect} from '@playwright/test';
import {mockCatalog} from './catalog-fixtures';
test('root, locale state preservation, theme and unavailable search',async({page,context})=>{
 await mockCatalog(context);await page.goto('/');await expect(page).toHaveURL(/\/ru$/);await expect(page.getByRole('heading',{level:1})).toHaveText('Ваш автомобиль. Его запчасти.');
 await expect(page.getByPlaceholder('Поиск по названию или номеру запчасти')).toBeDisabled();
 await page.goto('/ru?makeId=fixture-ford');await page.getByRole('button',{name:'Сменить язык'}).click();await expect(page).toHaveURL(/\/en\?makeId=fixture-ford$/);
 await page.getByRole('button',{name:'Toggle theme'}).click();const theme=await page.locator('html').getAttribute('data-theme');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',theme!);
});
test('favorite star persists, restores model and synchronizes tabs',async({page,context})=>{
 await mockCatalog(context);await page.goto('/en?makeId=fixture-ford&modelId=car%3Afixture');await page.getByRole('button',{name:'Save model',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'Remove from favorites',exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Change language'}).click();await expect(page).toHaveURL(/\/ru\?/);await expect(page.getByRole('button',{name:'Удалить из избранного',exact:true}).first()).toBeVisible();
 const second=await context.newPage();await second.goto('/en?makeId=fixture-ford&modelId=car%3Afixture');await second.getByRole('button',{name:'Remove from favorites',exact:true}).last().click();await expect(page.getByRole('button',{name:'Сохранить модель',exact:true})).toBeVisible();
});
test('corrupted and blocked storage recover on mobile',async({page,context})=>{
 await mockCatalog(context);await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>localStorage.setItem('selection-auto-parts:favorite-models:v1','invalid'));await page.goto('/en');await expect(page.getByRole('heading',{name:'Choose a vehicle',exact:true})).toBeVisible();
 await page.addInitScript(()=>Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw new DOMException('Blocked','SecurityError');}}));await page.reload();await expect(page.getByRole('alert').filter({hasText:'Your browser cannot save favorites'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('hierarchy selects source variant and part, shows OE before aftermarket and resets children',async({page,context})=>{
 await mockCatalog(context);await page.goto('/en');const make=page.getByRole('combobox',{name:'Make',exact:true});await make.fill('FORD');await make.press('Enter');
 const model=page.getByRole('combobox',{name:'Model',exact:true});await model.fill('FOCUS');await model.press('Enter');
 const variant=page.getByRole('combobox',{name:'Variant / engine',exact:true});await variant.click();await variant.press('Enter');
 const type=page.getByRole('combobox',{name:'Parts type',exact:true});await type.fill('Engine');await type.press('Enter');const group=page.getByRole('combobox',{name:'Parts group',exact:true});await group.fill('Piston');await group.press('Enter');
 await expect(page.locator('.part-result')).toHaveCount(1);await expect(page.locator('.oe-block')).toContainText('OE-123');await expect(page.locator('.aftermarket-row')).toContainText('Fixture manufacturer');await expect(page.locator('.cross-block')).toContainText('TEST-122');
 await page.getByRole('button',{name:'Change language'}).click();await expect(page.locator('.part-result h4')).toHaveText('Поршень');await expect(page).toHaveURL(/categoryId=fixture-piston/);
 const other=page.getByRole('combobox',{name:'Марка',exact:true});await other.fill('Other');await other.press('Enter');await expect(page.getByRole('combobox',{name:'Модель',exact:true})).toBeDisabled();await expect(page.locator('.part-result')).toHaveCount(0);await expect(page).not.toHaveURL(/modelId=|variantId=|categoryId=/);
});
test('large OE lists load bounded pages and keep the aftermarket number visible',async({page,context})=>{
 await mockCatalog(context);
 const oe=(index:number)=>({manufacturer:'Fixture OE',number:`REF-${index}`,information:'',additive:false});
 await context.route('**/api/v1/parts/by-vehicle?*',route=>route.fulfill({json:{total:1,page:1,limit:20,data:[{id:'fixture-part',brand:'Fixture manufacturer',number:'TEST-123',label:'Piston',oe:Array.from({length:20},(_,i)=>oe(i+1)),oeTotal:21,crosses:[],conditions:[],fitmentGroups:[]}]}}));
 await context.route('**/api/v1/parts/references?*',route=>{const url=new URL(route.request().url());expect(url.searchParams.get('partId')).toBe('fixture-part');const page=Number(url.searchParams.get('page'));return route.fulfill({json:{total:21,page,limit:20,oe:page===2?[oe(21)]:Array.from({length:20},(_,i)=>oe(i+1)),crosses:[]}});});
 await page.goto('/en?makeId=fixture-ford&modelId=car%3Afixture&variantId=car%3Afixture-variant&categoryId=fixture-piston');
 const pages=page.getByRole('navigation',{name:'Original reference pages'});
 await pages.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('.oe-block')).toContainText('REF-21');await expect(page.locator('.oe-block li')).toHaveCount(1);
 await expect(page.locator('.aftermarket-row')).toContainText('TEST-123');await pages.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.locator('.oe-block li')).toHaveCount(20);
});
