package com.quicktrello.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class QuickPhotoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            WidgetHelper.updateWidget(
                context,
                appWidgetManager,
                appWidgetId,
                R.layout.widget_photo,
                R.id.widget_photo_root,
                "photo",
                102
            );
        }
    }
}
