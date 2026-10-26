/* Prueba de hardware: el LED (GPIO 18) y el buzzer (GPIO 23, por el NPN) siguen al pulsador (GPIO 27 a GND). */
constexpr uint8_t LED_PIN = 18, BUTTON_PIN = 27, BUZZER_PIN = 23;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.println("Prueba lista. Pulsa el boton: el LED debe encender y el buzzer sonar.");
}

void loop() {
  static bool anterior = HIGH;
  bool boton = digitalRead(BUTTON_PIN);
  digitalWrite(LED_PIN, boton == LOW ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, boton == LOW ? HIGH : LOW);
  if (boton != anterior) {
    Serial.println(boton == LOW ? "[BOTON] pulsado, LED y buzzer ON" : "[BOTON] suelto, LED y buzzer OFF");
    anterior = boton;
  }
  delay(10);
}
