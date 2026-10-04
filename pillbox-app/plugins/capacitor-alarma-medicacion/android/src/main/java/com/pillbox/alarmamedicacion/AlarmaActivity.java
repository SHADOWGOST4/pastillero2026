package com.pillbox.alarmamedicacion;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.List;

/**
 * Pantalla de la alarma sobre el bloqueo. También hace de puerta de los botones de la notificación ("Ya lo tomé" y
 * "Posponer"): Android no permite abrir la app desde un receptor, pero sí desde una actividad.
 */
public class AlarmaActivity extends Activity {
    private final Handler manejador = new Handler(Looper.getMainLooper());
    private final Runnable vigilar = new Runnable() {
        @Override
        public void run() {
            // Si la alarma se apagó por otro lado (la placa, la app, otro teléfono), la pantalla se cierra sola.
            if (AlarmaService.sonando().isEmpty()) {
                finish();
            } else {
                manejador.postDelayed(this, 1000);
            }
        }
    };

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        mostrarSobreElBloqueo();
        String accion = getIntent().getAction();
        if (Alarma.ACCION_TOME.equals(accion)) {
            tome();
            finish();
            return;
        }
        if (Alarma.ACCION_POSPONER.equals(accion)) {
            posponer();
            finish();
            return;
        }
        construirPantalla();
        manejador.postDelayed(vigilar, 1000);
    }

    @Override
    protected void onDestroy() {
        manejador.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void mostrarSobreElBloqueo() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void construirPantalla() {
        List<Programada> lista = AlarmaService.sonando();
        StringBuilder cuerpo = new StringBuilder();
        for (Programada p : lista) {
            if (cuerpo.length() > 0) cuerpo.append('\n');
            cuerpo.append(p.cuerpo);
        }

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(Color.parseColor("#0F172A"));
        int margen = (int) (24 * getResources().getDisplayMetrics().density);
        raiz.setPadding(margen, margen, margen, margen);

        TextView titulo = new TextView(this);
        titulo.setText(lista.size() > 1 ? "Hora de tomar tus medicamentos" : "Hora de tomar tu medicamento");
        titulo.setTextColor(Color.WHITE);
        titulo.setTextSize(26);
        titulo.setGravity(Gravity.CENTER);
        raiz.addView(titulo);

        TextView detalle = new TextView(this);
        detalle.setText(cuerpo.toString());
        detalle.setTextColor(Color.parseColor("#CBD5E1"));
        detalle.setTextSize(20);
        detalle.setGravity(Gravity.CENTER);
        detalle.setPadding(0, margen, 0, margen * 2);
        raiz.addView(detalle);

        Button tome = new Button(this);
        tome.setText("Ya lo tomé");
        tome.setTextSize(20);
        tome.setOnClickListener(v -> {
            tome();
            finish();
        });
        raiz.addView(tome, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        Button posponer = new Button(this);
        posponer.setText("Posponer 5 minutos");
        posponer.setOnClickListener(v -> {
            posponer();
            finish();
        });
        LinearLayout.LayoutParams parametros = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        parametros.topMargin = margen / 2;
        raiz.addView(posponer, parametros);

        setContentView(raiz);
    }

    /** Silencia, anota las tomas para enviarlas al servidor y abre la app, que es quien tiene la sesión. */
    private void tome() {
        for (Programada p : AlarmaService.sonando()) {
            Almacen.agregarConfirmacion(this, p.horarioId, p.instanteMs);
        }
        AlarmaService.detenerTodo();
        Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (abrir != null) {
            abrir.putExtra("alarma_confirmar", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(abrir);
        }
    }

    private void posponer() {
        for (Programada p : AlarmaService.sonando()) {
            Programador.posponer(this, p, Alarma.POSPONER_MS);
        }
        AlarmaService.detenerTodo();
    }
}
