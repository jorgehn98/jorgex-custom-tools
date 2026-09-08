---
name: mcp-meta-ads
description: >
  Herramientas MCP de Meta Ads propias (PhotoHeart) — 40 tools para gestionar campañas de Facebook/Instagram.
  Usar cuando necesites trabajar con Meta Ads: ver campañas, crear/editar anuncios, analizar métricas de rendimiento,
  gestionar audiencias, subir creatividades, configurar targeting, o cualquier operación con la cuenta de ads.
  TRIGGER cuando el usuario mencione: Meta Ads, Facebook Ads, Instagram Ads, campañas, anuncios, creativos,
  presupuesto de ads, insights, ROAS, audiencias personalizadas, lookalike, targeting, intereses,
  o quiera ver/crear/pausar/duplicar cualquier elemento del gestor de anuncios.
---

# MCP de Meta Ads — PhotoHeart

MCP propio ubicado en `C:/dev/work/jorgex-custom-tools/mcps/meta-ads-mcp/`.
**40 tools** que cubren todo el ciclo de vida de campañas en Meta (Facebook + Instagram).
**API version:** v22.0

## Configuración

Token en `.mcp.json` del proyecto (campo `META_ACCESS_TOKEN`).
Permisos requeridos: `ads_management`, `ads_read`, `pages_read_engagement`, `pages_manage_ads`.

**Importante:** El token (System User) necesita tener acceso a la **Página de Facebook** en Business Manager con rol Advertiser/Admin. Sin esto, crear ads que referencien la página falla con "No tienes permiso de anunciante en la página".

**ID de cuenta de ads:** Usar `meta_get_ad_accounts` para obtenerlo si no lo tienes.
El ID tiene formato `act_XXXXXXXXX` — al pasarlo a los tools, pasar **solo el número** sin `act_`.

---

## Tools disponibles — referencia rápida

### Cuentas
| Tool | Uso |
|------|-----|
| `meta_get_ad_accounts` | Listar todas las cuentas accesibles con el token |
| `meta_get_account_info` | Detalles de una cuenta: presupuesto, moneda, estado |
| `meta_get_account_pages` | Páginas de Facebook asociadas (necesario para creativos) |
| `meta_search_pages` | Buscar página por nombre para obtener su ID |

### Campañas
| Tool | Uso |
|------|-----|
| `meta_get_campaigns` | Listar campañas (filtrable por status) |
| `meta_get_campaign_details` | Todos los detalles de una campaña |
| `meta_create_campaign` | Crear nueva campaña |
| `meta_update_campaign` | Cambiar nombre, status, presupuesto |
| `meta_duplicate_campaign` | Copiar campaña (con todos sus ad sets y ads) |
| `meta_bulk_update_campaigns` | Pausar/activar múltiples campañas a la vez |

### Ad Sets
| Tool | Uso |
|------|-----|
| `meta_get_adsets` | Listar ad sets (filtrable por campaña o status) |
| `meta_get_adset_details` | Detalles completos incluyendo targeting spec |
| `meta_create_adset` | Crear ad set con targeting, presupuesto y optimización |
| `meta_update_adset` | Actualizar presupuesto, targeting, status |
| `meta_duplicate_adset` | Copiar ad set a otra campaña |
| `meta_bulk_update_adsets` | Actualizar múltiples ad sets a la vez |

### Ads
| Tool | Uso |
|------|-----|
| `meta_get_ads` | Listar ads (filtrable por campaña, ad set o status) |
| `meta_get_ad_details` | Detalles del ad incluyendo su creativo |
| `meta_create_ad` | Crear ad usando un creativo existente |
| `meta_update_ad` | Cambiar status, nombre o creativo |
| `meta_duplicate_ad` | Copiar ad a otro ad set |
| `meta_bulk_update_ads` | Pausar/activar múltiples ads a la vez |

### Creativos
| Tool | Uso |
|------|-----|
| `meta_get_ad_creatives` | Listar creativos de la cuenta o de un ad específico |
| `meta_get_ad_image` | Obtener URL de la imagen de un creativo |
| `meta_upload_ad_image` | Subir imagen (ruta local o URL pública) → devuelve hash |
| `meta_upload_ad_video` | Subir vídeo desde ruta local → devuelve video_id |
| `meta_create_ad_creative` | Crear creativo de imagen/vídeo con texto y CTA |
| `meta_create_carousel_ad_creative` | Crear creativo carousel con 2-10 tarjetas |
| `meta_update_ad_creative` | Actualizar nombre del creativo |

### Insights y métricas
| Tool | Uso |
|------|-----|
| `meta_get_insights` | Métricas de rendimiento para cuenta/campaña/adset/ad |
| `meta_bulk_get_insights` | Métricas de múltiples objetos a la vez |

### Targeting
| Tool | Uso |
|------|-----|
| `meta_search_interests` | Buscar intereses por keyword (ej: "fotografía") |
| `meta_get_interest_suggestions` | Intereses relacionados a partir de seeds |
| `meta_validate_interests` | Verificar que IDs de intereses son válidos |
| `meta_search_behaviors` | Buscar comportamientos (viajero frecuente, etc.) |
| `meta_search_demographics` | Buscar opciones demográficas (educación, estado civil) |
| `meta_search_geo_locations` | Buscar ciudades, regiones, países por nombre |
| `meta_estimate_audience_size` | Estimar alcance de un targeting spec |

### Audiencias
| Tool | Uso |
|------|-----|
| `meta_get_custom_audiences` | Listar audiencias personalizadas de la cuenta |
| `meta_create_custom_audience` | Crear audiencia de pixel, lista de clientes o engagement |
| `meta_create_lookalike_audience` | Crear lookalike a partir de una audiencia fuente |

---

## Workflows comunes

Ver [`references/workflows.md`](./references/workflows.md) para guías paso a paso de:
- Crear campaña completa desde cero
- Analizar rendimiento y comparar periodos
- Duplicar y escalar campañas que funcionan
- Construir targeting con intereses + exclusiones
- Crear y testear creativos A/B

---

## Jerarquía de objetos Meta

```
Ad Account (act_XXXXXXXXX)
  └── Campaign          ← objetivo, presupuesto total
        └── Ad Set      ← targeting, presupuesto diario, optimización
              └── Ad    ← creativo + configuración final
```

**Flujo obligatorio para crear un anuncio nuevo:**
1. `meta_upload_ad_image` → obtener `image_hash`
2. `meta_create_ad_creative` → obtener `creative_id` (necesita `page_id`)
3. `meta_create_campaign` → obtener `campaign_id`
4. `meta_create_adset` → obtener `adset_id` (necesita `campaign_id`)
5. `meta_create_ad` → anuncio final (necesita `adset_id` + `creative_id`)

---

## Objectives disponibles (campaña)

| Objetivo | Cuándo usar |
|----------|-------------|
| `OUTCOME_AWARENESS` | Reconocimiento de marca, alcance |
| `OUTCOME_TRAFFIC` | Tráfico a web o app |
| `OUTCOME_ENGAGEMENT` | Interacciones, visualizaciones de vídeo |
| `OUTCOME_LEADS` | Formularios de leads, DMs |
| `OUTCOME_SALES` | Conversiones web, ventas de catálogo |
| `OUTCOME_APP_PROMOTION` | Instalaciones y eventos en app |

---

## Insights — campos y breakdowns clave

**date_preset más usados:** `today`, `yesterday`, `last_7d`, `last_30d`, `last_month`, `this_month`

**Campos de métricas importantes:**
```
spend, impressions, reach, frequency, clicks, ctr, cpc, cpm, cpp,
actions, cost_per_action_type, conversions, cost_per_conversion,
roas, video_p25/p50/p75/p100_watched_actions
```

**Breakdowns útiles:** `age`, `gender`, `country`, `placement`, `device_platform`, `publisher_platform`

**action_type comunes en `actions`:**
- `link_click` — clics en el enlace
- `landing_page_view` — visitas a la web
- `purchase` — compras
- `lead` — leads generados
- `complete_registration` — registros
- `add_to_cart` — añadidos al carrito

**Ejemplo de llamada completa:**
```
meta_get_insights(
  object_id: "act_XXXXXXXXX",  ← o campaign_id, adset_id, ad_id
  level: "campaign",
  date_preset: "last_30d",
  breakdowns: "age,gender",
  time_increment: 1,            ← daily
  fields: "spend,impressions,clicks,ctr,actions,cost_per_action_type"
)
```

---

## Targeting spec — estructura

El `targeting` en `meta_create_adset` acepta este objeto:

```json
{
  "age_min": 25,
  "age_max": 45,
  "genders": ["1"],
  "geo_locations": {
    "countries": ["ES"],
    "cities": [{ "key": "518543", "radius": 30, "distance_unit": "kilometer" }]
  },
  "interests": [
    { "id": "6003249025895", "name": "Photography" }
  ],
  "behaviors": [
    { "id": "6002714895372", "name": "Frequent Travelers" }
  ],
  "custom_audiences": [{ "id": "AUDIENCE_ID" }],
  "excluded_custom_audiences": [{ "id": "BUYERS_AUDIENCE_ID" }],
  "publisher_platforms": ["facebook", "instagram"],
  "facebook_positions": ["feed", "story"],
  "instagram_positions": ["stream", "story", "reels"],
  "device_platforms": ["mobile"]
}
```

**Antes de crear el ad set:** Usar `meta_estimate_audience_size` para validar.
- Muy pequeña (<50K): targeting demasiado restrictivo
- Ideal: 100K–10M para la mayoría de objetivos
- Muy grande (>50M): considerar segmentar más

---

## Presupuestos — reglas importantes

- `daily_budget` y `lifetime_budget` se expresan en **centésimas de la moneda** de la cuenta
  - EUR: 1000 = 10€, 5000 = 50€
- Si la cuenta es en EUR, no mezclar con USD
- `daily_budget` va en el **Ad Set** para campañas sin CBO (Campaign Budget Optimization)
- `daily_budget` va en la **Campaign** cuando se usa CBO (`bid_strategy` a nivel de campaña)
- Siempre crear con `status: "PAUSED"` y activar manualmente tras revisar

---

## Notas v22.0 — cambios importantes

### Campañas sin CBO (presupuesto en ad set)
- v22.0 requiere `is_adset_budget_sharing_enabled` cuando la campaña NO tiene budget propio
- El MCP lo auto-establece a `false` si no se pasa y no hay `daily_budget`/`lifetime_budget` en la campaña
- Si se quiere CBO, poner `daily_budget` o `lifetime_budget` en la campaña (no en el ad set)

### Ad Sets — parámetros de conversión
- Para campañas `OUTCOME_SALES` con `optimization_goal: "OFFSITE_CONVERSIONS"`, el ad set requiere:
  - `promoted_object`: `{ pixel_id: "...", custom_event_type: "COMPLETE_REGISTRATION" }` (u otro evento)
  - `attribution_spec`: opcional pero recomendado, ej: `[{event_type: "CLICK_THROUGH", window_days: 7}]`
  - `destination_type: "WEBSITE"`

### Advantage+ Audience
- Cuando se usa Advantage+ Audience, `age_max` debe ser **65** (el máximo). Valores menores causan error: "La edad máxima está por debajo del límite permitido"

### Audiencias — `subtype` eliminado
- El parámetro `subtype` ya no se acepta en v22.0 para `meta_create_custom_audience`
- Meta infiere el tipo de audiencia automáticamente a partir del parámetro `rule`
- **Custom Audiences ToS**: Requiere aceptar los Terms of Service primero en `https://www.facebook.com/customaudiences/app/tos/?act=AD_ACCOUNT_ID`

---

## Reglas y limitaciones conocidas de la API

- **No se puede cambiar el objetivo** de una campaña después de crearla
- **`special_ad_categories`** es obligatorio — usar `["NONE"]` si no aplica categoría especial
- **No se pueden copiar ads entre campañas con objetivos diferentes** (ej: TRAFFIC → SALES). Reutilizar el `creative_id` directamente
- Los creativos de vídeo pueden tardar varios minutos en procesarse tras la subida
- Las audiencias Lookalike pueden tardar horas en estar disponibles
- El endpoint `/reachestimate` puede devolver `estimate_ready: false` — reintentar en segundos
- Rate limit: ventana de 1 hora. Si aparece error 4/17/32, esperar antes de reintentar
- Error 190 = token expirado → renovar `META_ACCESS_TOKEN`
- Los ad sets con `lifetime_budget` requieren `end_time`
