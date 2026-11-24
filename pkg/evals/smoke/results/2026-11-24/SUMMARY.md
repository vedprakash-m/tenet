# Smoke matrix

| Repository | Policy | Command | Exit code | Seconds | Problem |
|---|---|---|---:|---:|---|
| tenet-copilot | without-tenet-yaml | onboard --inventory-only --json | 0 | 4.530 | ok |
| tenet-copilot | without-tenet-yaml | check --json | 3 | 1.420 | TN-POLICY-MISSING |
| tenet-copilot | without-tenet-yaml | board --json | 3 | 1.436 | TN-POLICY-MISSING |
| tenet-copilot | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.478 | TN-POLICY-MISSING |
| tenet-copilot | without-tenet-yaml | verify --run-checks --json | 2 | 1.489 | ok |
| tenet-copilot | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 4.972 | ok |
| tenet-copilot | with-minimal-tenet-yaml | check --json | 1 | 1.869 | ok |
| tenet-copilot | with-minimal-tenet-yaml | board --json | 0 | 2.570 | ok |
| tenet-copilot | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.509 | ok |
| tenet-copilot | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.458 | ok |
| BotFramework-WebChat | without-tenet-yaml | onboard --inventory-only --json | 0 | 16.027 | ok |
| BotFramework-WebChat | without-tenet-yaml | check --json | 3 | 1.456 | TN-POLICY-MISSING |
| BotFramework-WebChat | without-tenet-yaml | board --json | 3 | 1.547 | TN-POLICY-MISSING |
| BotFramework-WebChat | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.602 | TN-POLICY-MISSING |
| BotFramework-WebChat | without-tenet-yaml | verify --run-checks --json | 2 | 1.523 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 15.604 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | check --json | 1 | 1.974 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | board --json | 0 | 2.305 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.534 | ok |
| BotFramework-WebChat | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.490 | ok |
| torus | without-tenet-yaml | onboard --inventory-only --json | 0 | 2.358 | ok |
| torus | without-tenet-yaml | check --json | 3 | 1.473 | TN-POLICY-MISSING |
| torus | without-tenet-yaml | board --json | 3 | 1.654 | TN-POLICY-MISSING |
| torus | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.482 | TN-POLICY-MISSING |
| torus | without-tenet-yaml | verify --run-checks --json | 2 | 1.442 | ok |
| torus | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 2.283 | ok |
| torus | with-minimal-tenet-yaml | check --json | 1 | 1.834 | ok |
| torus | with-minimal-tenet-yaml | board --json | 0 | 1.822 | ok |
| torus | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.583 | ok |
| torus | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.571 | ok |
| pytest-django | without-tenet-yaml | onboard --inventory-only --json | 0 | 2.554 | ok |
| pytest-django | without-tenet-yaml | check --json | 3 | 1.580 | TN-POLICY-MISSING |
| pytest-django | without-tenet-yaml | board --json | 3 | 1.594 | TN-POLICY-MISSING |
| pytest-django | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.576 | TN-POLICY-MISSING |
| pytest-django | without-tenet-yaml | verify --run-checks --json | 2 | 1.547 | ok |
| pytest-django | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 2.547 | ok |
| pytest-django | with-minimal-tenet-yaml | check --json | 1 | 2.631 | ok |
| pytest-django | with-minimal-tenet-yaml | board --json | 0 | 2.078 | ok |
| pytest-django | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.577 | ok |
| pytest-django | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.549 | ok |
| urfave-cli | without-tenet-yaml | onboard --inventory-only --json | 0 | 3.996 | ok |
| urfave-cli | without-tenet-yaml | check --json | 3 | 1.552 | TN-POLICY-MISSING |
| urfave-cli | without-tenet-yaml | board --json | 3 | 1.540 | TN-POLICY-MISSING |
| urfave-cli | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.544 | TN-POLICY-MISSING |
| urfave-cli | without-tenet-yaml | verify --run-checks --json | 2 | 1.555 | ok |
| urfave-cli | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 3.990 | ok |
| urfave-cli | with-minimal-tenet-yaml | check --json | 1 | 3.133 | ok |
| urfave-cli | with-minimal-tenet-yaml | board --json | 0 | 2.217 | ok |
| urfave-cli | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.611 | ok |
| urfave-cli | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.550 | ok |
| eslint-plugin-jest | without-tenet-yaml | onboard --inventory-only --json | 0 | 3.481 | ok |
| eslint-plugin-jest | without-tenet-yaml | check --json | 3 | 1.591 | TN-POLICY-MISSING |
| eslint-plugin-jest | without-tenet-yaml | board --json | 3 | 1.571 | TN-POLICY-MISSING |
| eslint-plugin-jest | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.610 | TN-POLICY-MISSING |
| eslint-plugin-jest | without-tenet-yaml | verify --run-checks --json | 2 | 1.664 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 3.649 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | check --json | 1 | 3.376 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | board --json | 0 | 2.374 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.698 | ok |
| eslint-plugin-jest | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.620 | ok |
| architecture-decision-record | without-tenet-yaml | onboard --inventory-only --json | 1 | 52.850 | ok |
| architecture-decision-record | without-tenet-yaml | check --json | 3 | 1.615 | TN-POLICY-MISSING |
| architecture-decision-record | without-tenet-yaml | board --json | 3 | 1.607 | TN-POLICY-MISSING |
| architecture-decision-record | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.626 | TN-POLICY-MISSING |
| architecture-decision-record | without-tenet-yaml | verify --run-checks --json | 2 | 1.613 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | onboard --inventory-only --json | 1 | 52.403 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | check --json | 1 | 1.917 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | board --json | 0 | 2.482 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.595 | ok |
| architecture-decision-record | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.559 | ok |
| lerna | without-tenet-yaml | onboard --inventory-only --json | 0 | 5.344 | ok |
| lerna | without-tenet-yaml | check --json | 3 | 1.557 | TN-POLICY-MISSING |
| lerna | without-tenet-yaml | board --json | 3 | 1.554 | TN-POLICY-MISSING |
| lerna | without-tenet-yaml | context --query test --budget-tokens 2000 --json | 3 | 1.538 | TN-POLICY-MISSING |
| lerna | without-tenet-yaml | verify --run-checks --json | 2 | 1.537 | ok |
| lerna | with-minimal-tenet-yaml | onboard --inventory-only --json | 0 | 5.116 | ok |
| lerna | with-minimal-tenet-yaml | check --json | 1 | 6.827 | ok |
| lerna | with-minimal-tenet-yaml | board --json | 0 | 2.496 | ok |
| lerna | with-minimal-tenet-yaml | context --query test --budget-tokens 2000 --json | 0 | 1.569 | ok |
| lerna | with-minimal-tenet-yaml | verify --run-checks --json | 2 | 1.552 | ok |
