"""Real Chromium DOM behavior with owned script bytes; no URL navigation or provider traffic."""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class ChatDialog(unittest.TestCase):
 def test_native_dialog_focus_escape_and_preserved_messages(self):
  with sync_playwright() as p:
   b=p.chromium.launch(headless=True,**({'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}))
   page=b.new_page();page.set_content('<button id="trigger">Chat</button><div id="root"></div>')
   page.add_script_tag(content=(ROOT/'assets/js/zada-holo-ui.js').read_text(encoding='utf-8'))
   page.evaluate('''()=>{window.ui=new ZadaHoloUI();ui.mount(document.getElementById('root'));document.getElementById('trigger').focus();ui.open();ui.addMessage('user','Preserve my idea');}''')
   self.assertEqual(page.locator('.zada-hud').evaluate('(e)=>e.tagName'),'DIALOG')
   self.assertTrue(page.locator('.zada-input-field').evaluate('(e)=>e===document.activeElement'))
   page.evaluate('''()=>{const d=document.createElement('dialog');d.id='project';d.innerHTML='<button>Project detail</button>';document.body.append(d);d.showModal();}''')
   page.keyboard.press('Escape')
   self.assertTrue(page.evaluate('ui.isOpen'))
   page.keyboard.press('Escape')
   self.assertFalse(page.evaluate('ui.isOpen'))
   self.assertEqual(page.evaluate('document.activeElement.id'),'trigger')
   page.evaluate('ui.open()')
   self.assertEqual(page.evaluate('ui.messages[0].text'),'Preserve my idea')
   b.close()
if __name__=='__main__':unittest.main()
