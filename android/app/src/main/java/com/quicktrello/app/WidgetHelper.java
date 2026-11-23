package com.quicktrello.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public final class WidgetHelper {
    public static final String EXTRA_WIDGET_ACTION = "quicktrello_action";

    private WidgetHelper() {}

    public static void updateWidget(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        int layoutId,
        int rootViewId,
        String actionType,
        int requestCode
    ) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction("com.quicktrello.app.WIDGET_" + actionType.toUpperCase());
        intent.putExtra(EXTRA_WIDGET_ACTION, actionType);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
        views.setOnClickPendingIntent(rootViewId, pendingIntent);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
