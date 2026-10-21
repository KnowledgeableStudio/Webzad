import unittest, importlib.util, tempfile
from pathlib import Path

class CapturePipelineTests(unittest.TestCase):
    def module(self):
        source = Path(__file__).resolve().parents[1] / 'tools/capture_portfolio.py'
        self.assertTrue(source.exists(), 'capture script is not implemented')
        spec = importlib.util.spec_from_file_location('capture_portfolio', source)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

    def test_exact_four_allowed_destinations(self):
        m = self.module()
        self.assertEqual(set(m.PROJECTS), {'zaddy', 'la-socieda', 'one-of-six', 'brg'})
        self.assertEqual(m.PROJECTS['zaddy']['url'], 'https://zaddy.art/')
        self.assertEqual(m.PROJECTS['brg']['url'], 'https://www.brgofficial.com/')

    def test_error_and_loading_pages_are_not_accepted(self):
        m = self.module()
        self.assertFalse(m.valid_page('Access denied — zaddy', 403, ['zaddy']))
        self.assertFalse(m.valid_page('Checking your browser zaddy', 200, ['zaddy']))
        self.assertFalse(m.valid_page('Loading', 200, ['zaddy']))
        self.assertTrue(m.valid_page('iZad Casanova music and Zaddy Collection merchandise', 200, ['izad', 'zaddy']))

    def test_derivatives_keep_raw_file_and_aspect_ratio(self):
        from PIL import Image
        m = self.module()
        with tempfile.TemporaryDirectory() as folder:
            raw = Path(folder) / 'raw.png'; Image.new('RGB', (1600, 1000)).save(raw)
            before = raw.read_bytes(); dest = Path(folder) / 'public'
            result = m.prepare_derivatives(raw, dest, 'desktop')
            self.assertEqual(raw.read_bytes(), before)
            self.assertEqual([v['width'] for v in result], [640, 960, 1600])
            for value in result:
                with Image.open(value['path']) as image:
                    self.assertEqual(image.width / image.height, 1.6)

if __name__ == '__main__': unittest.main()
