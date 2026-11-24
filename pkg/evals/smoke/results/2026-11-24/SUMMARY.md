# Smoke matrix

| Repository | Policy | Command | Exit code | Seconds | Problem |
|---|---|---|---:|---:|---|
| tenet-copilot | without-tenet-yaml | onboard --inventory-only --json | 0 | 7.817 | ok |
| tenet-copilot | without-tenet-yaml | check --json | 1 | 4.569 | TN-INTERNAL |
| tenet-copilot | without-tenet-yaml | board --json | 1 | 3.707 | TN-INTERNAL |
| tenet-copilot | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 4.536 | TN-INTERNAL |
| tenet-copilot | without-tenet-yaml | verify --run-checks --json | 2 | 3.298 | ok |
| tenet-copilot | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 8.792 | ok |
| tenet-copilot | with-minimal-tenet-yaml | check --json | 1 | 4.816 | ok |
| tenet-copilot | with-minimal-tenet-yaml | board --json | 0 | 3.453 | ok |
| tenet-copilot | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 2.019 | ok |
| tenet-copilot | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.919 | ok |
| BotFramework-WebChat | without-tenet-yaml | onboard --inventory-only --json | 0 | 14.344 | ok |
| BotFramework-WebChat | without-tenet-yaml | check --json | 1 | 1.422 | TN-INTERNAL |
| BotFramework-WebChat | without-tenet-yaml | board --json | 1 | 1.352 | TN-INTERNAL |
| BotFramework-WebChat | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 1.488 | TN-INTERNAL |
| BotFramework-WebChat | without-tenet-yaml | verify --run-checks --json | 2 | 1.410 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 14.027 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | check --json | 1 | 2.586 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | board --json | 0 | 2.230 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 2.680 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 2.543 | ok |
| torus | without-tenet-yaml | onboard --inventory-only --json | 0 | 5.245 | ok |
| torus | without-tenet-yaml | check --json | 1 | 3.196 | TN-INTERNAL |
| torus | without-tenet-yaml | board --json | 1 | 2.369 | TN-INTERNAL |
| torus | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 2.530 | TN-INTERNAL |
| torus | without-tenet-yaml | verify --run-checks --json | 2 | 2.400 | ok |
| torus | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 3.954 | ok |
| torus | with-minimal-tenet-yaml | check --json | 1 | 2.961 | ok |
| torus | with-minimal-tenet-yaml | board --json | 0 | 2.266 | ok |
| torus | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.576 | ok |
| torus | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.464 | ok |
| pytest-django | without-tenet-yaml | onboard --inventory-only --json | 0 | 2.391 | ok |
| pytest-django | without-tenet-yaml | check --json | 1 | 1.357 | TN-INTERNAL |
| pytest-django | without-tenet-yaml | board --json | 1 | 1.326 | TN-INTERNAL |
| pytest-django | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 1.335 | TN-INTERNAL |
| pytest-django | without-tenet-yaml | verify --run-checks --json | 2 | 1.437 | ok |
| pytest-django | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 2.173 | ok |
| pytest-django | with-minimal-tenet-yaml | check --json | 1 | 2.234 | ok |
| pytest-django | with-minimal-tenet-yaml | board --json | 0 | 1.794 | ok |
| pytest-django | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.399 | ok |
| pytest-django | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.343 | ok |
| urfave-cli | without-tenet-yaml | onboard --inventory-only --json | 0 | 3.530 | ok |
| urfave-cli | without-tenet-yaml | check --json | 1 | 1.358 | TN-INTERNAL |
| urfave-cli | without-tenet-yaml | board --json | 1 | 1.341 | TN-INTERNAL |
| urfave-cli | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 1.320 | TN-INTERNAL |
| urfave-cli | without-tenet-yaml | verify --run-checks --json | 2 | 1.358 | ok |
| urfave-cli | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 3.495 | ok |
| urfave-cli | with-minimal-tenet-yaml | check --json | 1 | 4.235 | ok |
| urfave-cli | with-minimal-tenet-yaml | board --json | 0 | 1.904 | ok |
| urfave-cli | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.328 | ok |
| urfave-cli | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.363 | ok |
| eslint-plugin-jest | without-tenet-yaml | onboard --inventory-only --json | 0 | 3.177 | ok |
| eslint-plugin-jest | without-tenet-yaml | check --json | 1 | 1.364 | TN-INTERNAL |
| eslint-plugin-jest | without-tenet-yaml | board --json | 1 | 1.356 | TN-INTERNAL |
| eslint-plugin-jest | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 1.367 | TN-INTERNAL |
| eslint-plugin-jest | without-tenet-yaml | verify --run-checks --json | 2 | 2.702 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 6.453 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | check --json | 1 | 12.876 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | board --json | 0 | 4.634 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 3.193 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 2.645 | ok |
| architecture-decision-record | without-tenet-yaml | onboard --inventory-only --json | 1 | 48.941 | TN-INTERNAL |
| architecture-decision-record | without-tenet-yaml | check --json | 1 | 1.507 | TN-INTERNAL |
| architecture-decision-record | without-tenet-yaml | board --json | 1 | 1.419 | TN-INTERNAL |
| architecture-decision-record | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 1.709 | TN-INTERNAL |
| architecture-decision-record | without-tenet-yaml | verify --run-checks --json | 2 | 1.623 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | onboard --inventory-only --json | 1 | 30.254 | TN-INTERNAL |
| architecture-decision-record | with-minimal-tenet-yaml | check --json | 1 | 120.033 | slow |
| architecture-decision-record | with-minimal-tenet-yaml | board --json | 0 | 2.718 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.664 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.506 | ok |
| lerna | without-tenet-yaml | onboard --inventory-only --json | 0 | 5.264 | ok |
| lerna | without-tenet-yaml | check --json | 1 | 1.860 | TN-INTERNAL |
| lerna | without-tenet-yaml | board --json | 1 | 1.339 | TN-INTERNAL |
| lerna | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 1 | 1.338 | TN-INTERNAL |
| lerna | without-tenet-yaml | verify --run-checks --json | 2 | 1.309 | ok |
| lerna | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 5.105 | ok |
| lerna | with-minimal-tenet-yaml | check --json | 1 | 16.711 | ok |
| lerna | with-minimal-tenet-yaml | board --json | 0 | 2.252 | ok |
| lerna | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.398 | ok |
| lerna | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.319 | ok |
