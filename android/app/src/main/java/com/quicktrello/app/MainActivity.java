package com.quicktrello.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private String pendingWidgetAction = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBarsAndInsets();
        requestMediaPermissionsIfNeeded();
        captureWidgetAction(getIntent());
    }

    private void configureSystemBarsAndInsets() {
        int bgColor = Color.parseColor("#020617");
        getWindow().setBackgroundDrawable(new ColorDrawable(bgColor));
        getWindow().setStatusBarColor(bgColor);
        getWindow().setNavigationBarColor(bgColor);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(bgColor);
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return windowInsets;
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureWidgetAction(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingWidgetAction != null) {
            String actionToRun = pendingWidgetAction;
            pendingWidgetAction = null;
            dispatchActionWhenReady(actionToRun, 0);
        }
    }

    private void captureWidgetAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(WidgetHelper.EXTRA_WIDGET_ACTION);
        if (action != null && !action.isEmpty()) {
            pendingWidgetAction = action;
            intent.removeExtra(WidgetHelper.EXTRA_WIDGET_ACTION);
        }
    }

    private void dispatchActionWhenReady(final String action, final int attempt) {
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        final WebView webView = this.bridge.getWebView();
        webView.postDelayed(() -> {
            if (webView.getProgress() < 100 && attempt < 15) {
                dispatchActionWhenReady(action, attempt + 1);
                return;
            }
            String safeAction = action.replaceAll("[^a-zA-Z0-9_-]", "");
            String js =
                "window.__QUICKTRELLO_PENDING_ACTION__ = '" + safeAction + "';" +
                "window.dispatchEvent(new CustomEvent('quicktrello-widget-action', { detail: '" + safeAction + "' }));";
            webView.evaluateJavascript(js, null);
        }, attempt == 0 ? 150 : 200);
    }

    private void requestMediaPermissionsIfNeeded() {
        String[] required = new String[] {
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA
        };
        List<String> missing = new ArrayList<>();
        for (String perm : required) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                missing.add(perm);
            }
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                missing.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
    }
}
