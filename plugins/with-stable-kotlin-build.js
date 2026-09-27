const { withGradleProperties } = require('expo/config-plugins');

const STABLE_KOTLIN_PROPERTIES = {
  'kotlin.compiler.execution.strategy': 'in-process',
  'kotlin.incremental': 'false',
};

function withStableKotlinBuild(config) {
  return withGradleProperties(config, (gradleConfig) => {
    for (const [key, value] of Object.entries(STABLE_KOTLIN_PROPERTIES)) {
      const existing = gradleConfig.modResults.find(
        (item) => item.type === 'property' && item.key === key,
      );

      if (existing) {
        existing.value = value;
      } else {
        gradleConfig.modResults.push({ type: 'property', key, value });
      }
    }

    return gradleConfig;
  });
}

module.exports = withStableKotlinBuild;
