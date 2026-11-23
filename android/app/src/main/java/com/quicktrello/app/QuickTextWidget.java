package com.quicktrello.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class QuickTextWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            WidgetHelper.updateWidget(
                context,
                appWidgetManager,
                appWidgetId,
                R.layout.widget_text,
                R.id.widget_text_root,
                "text",
                103
            );
        }
    }
}
