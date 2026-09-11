"use client";

import { useEffect, useRef } from "react";
import { geoEquirectangular, geoPath } from "d3-geo";
import * as THREE from "three";
import { feature, mesh } from "topojson-client";
import type { FeatureCollection, Geometry, MultiLineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopologyData from "world-atlas/countries-110m.json";

type Route = {
  from: [number, number];
  to: [number, number];
  color: number;
  speed: number;
  offset: number;
};

const routes: Route[] = [
  { from: [23.81, 90.41], to: [42.36, -71.06], color: 0x9ff3d0, speed: 0.055, offset: 0.08 },
  { from: [40.71, -74.01], to: [51.51, -0.13], color: 0x8ed8ff, speed: 0.075, offset: 0.44 },
  { from: [25.2, 55.27], to: [1.35, 103.82], color: 0xffc878, speed: 0.065, offset: 0.72 },
  { from: [34.05, -118.24], to: [35.68, 139.69], color: 0xff8f79, speed: 0.06, offset: 0.24 },
  { from: [51.51, -0.13], to: [-33.92, 18.42], color: 0x73e0c1, speed: 0.05, offset: 0.87 },
  { from: [-33.87, 151.21], to: [-33.45, -70.67], color: 0x91bfff, speed: 0.043, offset: 0.63 },
  { from: [-23.55, -46.63], to: [-26.2, 28.05], color: 0xffa874, speed: 0.046, offset: 0.81 },
  { from: [25.29, 51.53], to: [34.05, -118.24], color: 0xc0a8ff, speed: 0.052, offset: 0.31 }
];

const majorCities: Array<[number, number]> = [
  [42.36, -71.06],
  [40.71, -74.01],
  [51.51, -0.13],
  [23.81, 90.41],
  [25.2, 55.27],
  [1.35, 103.82],
  [35.68, 139.69],
  [-33.87, 151.21],
  [34.05, -118.24],
  [-23.55, -46.63],
  [25.29, 51.53],
  [-33.92, 18.42],
  [-33.45, -70.67],
  [-26.2, 28.05]
];

function spherePoint(latitude: number, longitude: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

class FlightArcCurve extends THREE.Curve<THREE.Vector3> {
  private readonly startDirection: THREE.Vector3;
  private readonly endDirection: THREE.Vector3;
  private readonly angularDistance: number;
  private readonly sinAngularDistance: number;
  private readonly surfaceRadius: number;
  private readonly arcHeight: number;

  constructor(start: THREE.Vector3, end: THREE.Vector3) {
    super();
    this.startDirection = start.clone().normalize();
    this.endDirection = end.clone().normalize();
    this.angularDistance = this.startDirection.angleTo(this.endDirection);
    this.sinAngularDistance = Math.sin(this.angularDistance);
    this.surfaceRadius = Math.max(start.length(), end.length());
    this.arcHeight = 0.16 + Math.min(this.angularDistance / Math.PI, 1) * 0.62;
  }

  getPoint(progress: number, target = new THREE.Vector3()) {
    if (Math.abs(this.sinAngularDistance) < 0.0001) {
      target.lerpVectors(this.startDirection, this.endDirection, progress).normalize();
    } else {
      const startWeight = Math.sin((1 - progress) * this.angularDistance) / this.sinAngularDistance;
      const endWeight = Math.sin(progress * this.angularDistance) / this.sinAngularDistance;
      target
        .copy(this.startDirection)
        .multiplyScalar(startWeight)
        .addScaledVector(this.endDirection, endWeight)
        .normalize();
    }

    const altitude = this.arcHeight * Math.sin(Math.PI * progress);
    return target.multiplyScalar(this.surfaceRadius + altitude);
  }
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

type CountriesTopology = Topology<{ countries: GeometryCollection }>;

const countriesTopology = countriesTopologyData as unknown as CountriesTopology;
const countriesObject = countriesTopology.objects.countries;
const landFeature = feature(countriesTopology, countriesObject) as FeatureCollection<Geometry>;
const geographicLines = mesh(countriesTopology, countriesObject) as MultiLineString;

function createEarthTexture(land: FeatureCollection<Geometry>) {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the globe texture.");

  context.fillStyle = "#061719";
  context.fillRect(0, 0, width, height);

  const projection = geoEquirectangular()
    .translate([width / 2, height / 2])
    .scale(width / (2 * Math.PI));
  const path = geoPath(projection, context);

  context.beginPath();
  path(land);
  context.fillStyle = "#123b35";
  context.fill();
  context.strokeStyle = "rgba(127, 222, 190, 0.52)";
  context.lineWidth = 0.7;
  context.stroke();

  const pixels = context.getImageData(0, 0, width, height).data;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  return {
    texture,
    isLand(latitude: number, longitude: number) {
      const x = Math.min(width - 1, Math.max(0, Math.floor(((longitude + 180) / 360) * width)));
      const y = Math.min(height - 1, Math.max(0, Math.floor(((90 - latitude) / 180) * height)));
      return pixels[(y * width + x) * 4 + 1] > 40;
    }
  };
}

function createGeographicLineGeometry(lines: MultiLineString, radius: number) {
  const positions: number[] = [];

  lines.coordinates.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const [previousLongitude, previousLatitude] = line[index - 1];
      const [longitude, latitude] = line[index];

      // Avoid drawing a long chord when a boundary wraps across the antimeridian.
      if (Math.abs(longitude - previousLongitude) > 45) continue;

      const previous = spherePoint(previousLatitude, previousLongitude, radius);
      const current = spherePoint(latitude, longitude, radius);
      positions.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createPlaneGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.22, 0);
  shape.lineTo(0.045, 0.045);
  shape.lineTo(-0.025, 0.17);
  shape.lineTo(-0.085, 0.17);
  shape.lineTo(-0.045, 0.035);
  shape.lineTo(-0.16, 0.02);
  shape.lineTo(-0.205, 0.075);
  shape.lineTo(-0.235, 0.075);
  shape.lineTo(-0.215, 0);
  shape.lineTo(-0.235, -0.075);
  shape.lineTo(-0.205, -0.075);
  shape.lineTo(-0.16, -0.02);
  shape.lineTo(-0.045, -0.035);
  shape.lineTo(-0.085, -0.17);
  shape.lineTo(-0.025, -0.17);
  shape.lineTo(0.045, -0.045);
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.center();
  return geometry;
}

export function NightGlobeScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050a0d, 0.035);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 8.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x050a0d, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.dataset.testid = "night-globe";
    renderer.domElement.dataset.frame = "0";
    renderer.domElement.dataset.interactive = "false";
    renderer.domElement.dataset.routeCount = String(routes.length);
    renderer.domElement.dataset.routeVehicle = "plane";
    host.appendChild(renderer.domElement);

    const globe = new THREE.Group();
    scene.add(globe);

    const earthTexture = createEarthTexture(landFeature);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(2.42, 64, 64),
      new THREE.MeshPhongMaterial({
        map: earthTexture.texture,
        color: 0xb9d8cd,
        emissive: 0x061819,
        shininess: 24
      })
    );
    globe.add(earth);

    const grid = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(2.445, 36, 24)),
      new THREE.LineBasicMaterial({ color: 0x5fa49b, transparent: true, opacity: 0.13 })
    );
    globe.add(grid);

    const borders = new THREE.LineSegments(
      createGeographicLineGeometry(geographicLines, 2.472),
      new THREE.LineBasicMaterial({ color: 0x8adabe, transparent: true, opacity: 0.34 })
    );
    globe.add(borders);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.55, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { glowColor: { value: new THREE.Color(0x60dcb7) } },
        vertexShader: `
          varying vec3 vertexNormal;
          void main() {
            vertexNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vertexNormal;
          uniform vec3 glowColor;
          void main() {
            float intensity = pow(0.72 - dot(vertexNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            gl_FragColor = vec4(glowColor, intensity * 0.52);
          }
        `
      })
    );
    globe.add(glow);

    const lightPositions: number[] = [];
    let candidate = 0;
    while (lightPositions.length < 5100 && candidate < 12000) {
      const latitude = seededRandom(candidate + 11) * 150 - 68;
      const longitude = seededRandom(candidate + 901) * 360 - 180;
      if (earthTexture.isLand(latitude, longitude)) {
        const point = spherePoint(latitude, longitude, 2.46);
        lightPositions.push(point.x, point.y, point.z);
      }
      candidate += 1;
    }
    const lightsGeometry = new THREE.BufferGeometry();
    lightsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lightPositions, 3));
    const cityLights = new THREE.Points(
      lightsGeometry,
      new THREE.PointsMaterial({ color: 0xb9f6d9, size: 0.018, transparent: true, opacity: 0.58 })
    );
    globe.add(cityLights);

    const cityGeometry = new THREE.BufferGeometry().setFromPoints(
      majorCities.map(([latitude, longitude]) => spherePoint(latitude, longitude, 2.485))
    );
    const majorCityLights = new THREE.Points(
      cityGeometry,
      new THREE.PointsMaterial({ color: 0xffd28a, size: 0.065, transparent: true, opacity: 0.95 })
    );
    globe.add(majorCityLights);

    const routeCurves: FlightArcCurve[] = [];
    const routePlanes: THREE.Mesh[] = [];
    const planeGeometry = createPlaneGeometry();
    routes.forEach((route) => {
      const start = spherePoint(route.from[0], route.from[1], 2.49);
      const end = spherePoint(route.to[0], route.to[1], 2.49);
      const curve = new FlightArcCurve(start, end);
      routeCurves.push(curve);

      const line = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 72, 0.009, 6, false),
        new THREE.MeshBasicMaterial({ color: route.color, transparent: true, opacity: 0.62 })
      );
      globe.add(line);

      const plane = new THREE.Mesh(
        planeGeometry,
        new THREE.MeshBasicMaterial({
          color: route.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95
        })
      );
      plane.scale.setScalar(0.48);
      plane.userData = route;
      routePlanes.push(plane);
      globe.add(plane);
    });
    const minimumRouteRadius = Math.min(
      ...routeCurves.flatMap((curve) => curve.getPoints(120).map((point) => point.length()))
    );
    renderer.domElement.dataset.routeMinRadius = minimumRouteRadius.toFixed(3);

    const stars: number[] = [];
    for (let index = 0; index < 900; index += 1) {
      const radius = 12 + seededRandom(index + 301) * 16;
      const theta = seededRandom(index + 611) * Math.PI * 2;
      const phi = Math.acos(seededRandom(index + 991) * 2 - 1);
      stars.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
    const starField = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({ color: 0xd4e8e3, size: 0.028, transparent: true, opacity: 0.52 })
    );
    scene.add(starField);

    scene.add(new THREE.AmbientLight(0x4faaa0, 0.72));
    const rimLight = new THREE.DirectionalLight(0xa9ffe0, 2.7);
    rimLight.position.set(-4, 3, 6);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(0xffc878, 8, 20);
    warmLight.position.set(5, -3, 4);
    scene.add(warmLight);

    let pointerX = 0;
    let pointerY = 0;
    let targetRotationX = 0;
    let targetRotationY = -0.18;
    let dragVelocityX = 0;
    let dragVelocityY = 0;
    let activePointer: number | null = null;
    let previousPointerX = 0;
    let previousPointerY = 0;
    let frame = 0;
    let animationFrame = 0;
    const clock = new THREE.Clock();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const compact = width < 900;
      const middle = width >= 900 && width < 1200;
      globe.position.set(compact ? 0.9 : middle ? 2.05 : 2.35, compact ? 1.05 : -0.05, compact ? -0.8 : 0);
      globe.scale.setScalar(compact ? 0.72 : middle ? 0.88 : 1);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.28;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.18;

      if (activePointer === event.pointerId) {
        const deltaX = event.clientX - previousPointerX;
        const deltaY = event.clientY - previousPointerY;
        dragVelocityY = deltaX * 0.0045;
        dragVelocityX = deltaY * 0.003;
        targetRotationY += dragVelocityY;
        targetRotationX = THREE.MathUtils.clamp(targetRotationX + dragVelocityX, -0.48, 0.48);
        globe.rotation.y = targetRotationY;
        globe.rotation.x = targetRotationX;
        renderer.domElement.dataset.rotationY = globe.rotation.y.toFixed(4);
        previousPointerX = event.clientX;
        previousPointerY = event.clientY;
      }

      renderer.domElement.dataset.interactive = "true";
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "button, a, input, label, summary, select, textarea, nav, .fareping-command-deck, .fareping-trip-readout, .fareping-results-content"
        )
      ) {
        return;
      }

      event.preventDefault();
      activePointer = event.pointerId;
      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
      dragVelocityX = 0;
      dragVelocityY = 0;
      document.body.classList.add("fareping-globe-dragging");
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === activePointer) {
        activePointer = null;
        document.body.classList.remove("fareping-globe-dragging");
      }
    };

    const render = () => {
      const elapsed = clock.getElapsedTime();
      frame += 1;
      renderer.domElement.dataset.frame = String(frame);
      if (!reduceMotion && activePointer === null) {
        targetRotationY += 0.00065 + dragVelocityY;
        targetRotationX = THREE.MathUtils.clamp(targetRotationX + dragVelocityX, -0.48, 0.48);
        dragVelocityX *= 0.93;
        dragVelocityY *= 0.93;
      }
      globe.rotation.y += (targetRotationY - globe.rotation.y) * 0.07;
      globe.rotation.x += (targetRotationX + pointerY * 0.35 - globe.rotation.x) * 0.07;
      globe.rotation.z += (-pointerX - globe.rotation.z) * 0.018;
      renderer.domElement.dataset.rotationY = globe.rotation.y.toFixed(4);
      starField.rotation.y = elapsed * 0.002;

      routePlanes.forEach((plane, index) => {
        const route = plane.userData as Route;
        const progress = reduceMotion ? route.offset : (elapsed * route.speed + route.offset) % 1;
        const curve = routeCurves[index];
        const position = curve.getPointAt(progress);
        const tangent = curve.getTangentAt(progress).normalize();
        const surfaceNormal = position.clone().normalize();
        const wingAxis = surfaceNormal.clone().cross(tangent).normalize();
        const orientation = new THREE.Matrix4().makeBasis(tangent, wingAxis, surfaceNormal);

        plane.position.copy(position);
        plane.quaternion.setFromRotationMatrix(orientation);
        const shimmer = 0.46 + Math.sin(elapsed * 5 + index) * 0.025;
        plane.scale.setScalar(shimmer);
      });

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.classList.remove("fareping-globe-dragging");
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      earthTexture.texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="fareping-globe-scene" aria-hidden="true" />;
}
