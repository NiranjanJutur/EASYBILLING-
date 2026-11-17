package com.shoplegder;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;

public class VoiceRecognitionModule extends ReactContextBaseJavaModule implements RecognitionListener {
  private final ReactApplicationContext context;
  private SpeechRecognizer recognizer;

  VoiceRecognitionModule(ReactApplicationContext reactContext) {
    super(reactContext);
    context = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return "SMSVoiceRecognition";
  }

  @ReactMethod
  public void startListening(String language, Promise promise) {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("permission_denied", "Microphone permission is required for voice selection.");
      return;
    }
    UiThreadUtil.runOnUiThread(() -> {
      if (!SpeechRecognizer.isRecognitionAvailable(context)) {
        promise.reject("not_available", "No speech recognition service is available on this phone.");
        return;
      }
      releaseRecognizer();
      recognizer = SpeechRecognizer.createSpeechRecognizer(context);
      recognizer.setRecognitionListener(this);
      Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language == null || language.isEmpty() ? "en-IN" : language);
      intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
      intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
      try {
        recognizer.startListening(intent);
        promise.resolve(true);
      } catch (Exception error) {
        promise.reject("start_failed", error.getMessage(), error);
      }
    });
  }

  @ReactMethod
  public void stopListening() {
    UiThreadUtil.runOnUiThread(() -> {
      if (recognizer != null) recognizer.stopListening();
    });
  }

  @ReactMethod
  public void cancelListening() {
    UiThreadUtil.runOnUiThread(this::releaseRecognizer);
  }

  @ReactMethod
  public void addListener(String eventName) { }

  @ReactMethod
  public void removeListeners(Integer count) { }

  private void releaseRecognizer() {
    if (recognizer != null) {
      try { recognizer.cancel(); } catch (Exception ignored) { }
      try { recognizer.destroy(); } catch (Exception ignored) { }
      recognizer = null;
    }
  }

  private void emit(String event, String field, String value) {
    WritableMap map = Arguments.createMap();
    map.putString(field, value == null ? "" : value);
    try {
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(event, map);
    } catch (Exception ignored) { }
  }

  @Override public void onReadyForSpeech(android.os.Bundle params) { }
  @Override public void onBeginningOfSpeech() { }
  @Override public void onRmsChanged(float rmsdB) { }
  @Override public void onBufferReceived(byte[] buffer) { }
  @Override public void onEndOfSpeech() { }
  @Override public void onEvent(int eventType, android.os.Bundle params) { }

  @Override
  public void onPartialResults(android.os.Bundle results) {
    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
    if (matches != null && !matches.isEmpty()) emit("SMSVoicePartial", "transcript", matches.get(0));
  }

  @Override
  public void onResults(android.os.Bundle results) {
    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
    if (matches != null && !matches.isEmpty()) emit("SMSVoiceResult", "transcript", matches.get(0));
    releaseRecognizer();
  }

  @Override
  public void onError(int error) {
    emit("SMSVoiceError", "message", "Speech recognition error (" + error + "). Try again or check the phone's speech service.");
    releaseRecognizer();
  }
}
