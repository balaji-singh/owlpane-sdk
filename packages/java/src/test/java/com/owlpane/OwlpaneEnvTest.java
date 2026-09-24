package com.owlpane;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class OwlpaneEnvTest {
  @Test
  void defaultServiceNameWhenUnset() {
    assertEquals("java-app", OwlpaneEnv.serviceName());
  }
}
