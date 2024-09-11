Goal:
* remove flags without AI (predictability and more explicit work > probability)
* create spec for our own removal patterns
* create one lang impl to assess the effort before porting to other langs
* only real world use cases we have

Usages:
* specify directory/file
* specify flag name to remove
* keep flag, remove flag, keep variant options
* Support if, ternary and ConditionallyRender

Findings:
* apply simple transformations and let the linter do the remaining fixes (e.g. inline variable, let -> const)

Algorithm:
* find pattern (flagResolver for backend, and useUIFlag for frontend)
* pass 1: replace it with true (later also false and variant)
* pass 2: simplify boolean expressions
* pass 3: inline variable if boolean literal
* pass 4: remove if(true) (later if(false))
