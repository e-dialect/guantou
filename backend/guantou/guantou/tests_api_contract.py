import sys
from pathlib import Path

from django.test import SimpleTestCase

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from tools.api_contract.check_contract import contract_errors


class ApiContractDriftTests(SimpleTestCase):
    def test_retired_core_is_absent_and_v2_resources_match_openapi(self):
        self.assertEqual(contract_errors(), [])
