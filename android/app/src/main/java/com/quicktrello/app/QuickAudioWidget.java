package com.quicktrello.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class QuickAudioWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            WidgetHelper.updateWidget(
                context,
                appWidgetManager,
                appWidgetId,
                R.layout.widget_audio,
                R.id.widget_audio_root,
                "audio",
                101
            );
        }
    }
}
