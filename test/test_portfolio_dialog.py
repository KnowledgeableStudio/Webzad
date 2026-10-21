import unittest,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class PortfolioDialog(unittest.TestCase):
 def test_four_project_dialogs_and_legacy_studies(self):
  with sync_playwright() as p:
   b=p.chromium.launch(headless=True,**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}));page=b.new_page()
   page.set_content('<button id="trigger">View</button><section tabindex="-1" id="contact">Contact</section>')
   page.add_script_tag(content=(ROOT/'assets/js/portfolio.js').read_text(encoding='utf-8'))
   page.evaluate('window.p=WebzadPortfolioTools.createPortfolio({document,fetchFn:null})')
   for id in ['zaddy','la-socieda','one-of-six','brg']:
    page.evaluate('(id)=>{document.getElementById("trigger").focus();p.openProject(id,document.getElementById("trigger"));}',id)
    self.assertEqual(page.locator('dialog[open]').count(),1)
    self.assertIn('not been captured',page.locator('.capture-status-note').inner_text())
    self.assertEqual(page.locator('dialog a').get_attribute('rel'),'noopener noreferrer')
    page.keyboard.press('Escape');self.assertEqual(page.locator('dialog[open]').count(),0)
    self.assertEqual(page.evaluate('document.activeElement.id'),'trigger')
   page.evaluate('p.openStudy("services",document.getElementById("trigger"))')
   self.assertIn('NOT A VERIFIED',page.locator('dialog .eyebrow').inner_text())
   page.keyboard.press('Escape')
   self.assertFalse(page.evaluate('p.openProject("unknown")'))
   page.evaluate('p.openProject("brg")');page.locator('dialog .btn-primary').click()
   self.assertEqual(page.evaluate('document.activeElement.id'),'contact')
   b.close()
if __name__=='__main__':unittest.main()
