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

    return props;
  });
};
