import { render } from "preact";

import App from "./App";
import { installDevFetchProxy } from "./dev-fetch-proxy";
import "./styles.css";

installDevFetchProxy();

render(<App />, document.getElementById("app")!);
