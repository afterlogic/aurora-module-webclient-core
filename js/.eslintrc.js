module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "commonjs": true,
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": "2018"
    },
    plugins: ['import'],
    rules: {
        'import/no-unresolved': [
            "error",
            {
                "commonjs": true,
            }
        ],
        "import/no-cycle": [
            "error",
            {
                "commonjs": true,
                "maxDepth": 10,
                // "ignoreExternal": true
            }
        ]
        // 'import/named': 'error',
        // 'import/namespace': 'error',
        // 'import/default': 'error',
        // 'import/export': 'error',
    },
  }