const { withGradleProperties } = require("expo/config-plugins");

/**
 * Increases JVM heap to 4GB for complex Gradle builds with many native modules.
 */
module.exports = function withCustomGradleProperties(config) {
  return withGradleProperties(config, (props) => {
    const results = props.modResults;

    const set = (key, value) => {
      const idx = results.findIndex((p) => p.type === "property" && p.key === key);
      if (idx >= 0) {
        results[idx].value = value;
      } else {
        results.push({ type: "property", key, value });
      }
    };

    set("org.gradle.jvmargs", "-Xmx4096m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError");
    set("org.gradle.parallel", "true");
    // KSP K1 backend calls KotlinTypeMapper.LANGUAGE_VERSION_SETTINGS_DEFAULT which was
    // removed in Kotlin 2.0.x. Force K2 backend — Room 2.6.1 (used by expo-updates) supports it.
    set("ksp.useK2", "true");

    return props;
  });
};
