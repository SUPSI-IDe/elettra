import "./about.css";
import { initializeDeploymentVersions } from "../../deployment-versions";

export const initializeAbout = (root = document) =>
  initializeDeploymentVersions(root);
