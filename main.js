import Exponent from 'exponent';
import React from 'react';
import { Alert, PanResponder, View, TouchableHighlight, Text,
  StyleSheet, } from 'react-native';

import Assets from './Assets';
// import Game from './3DGame';
import Game from './2DGame';


//// App

// This is the root component of the app. It does any loading required
// then renders `Game`.

class App extends React.Component {
  state = {
    loaded: false,
    dx: 0,
    dy: 0,
  }

  componentWillMount() {
    // THREE warns about unavailable WebGL extensions.
    console.disableYellowBox = true;

    this.load();
  }

  // Do stuff that needs to be done before first render of scene.
  async load() {
    try {
      // Load assets
      await Promise.all(Object.keys(Assets).map((name) =>
        Assets[name].downloadAsync()));

      // We're good to go!
      this.setState({ loaded: true });
    } catch (e) {
      Alert.alert('Error when loading', e.message);
    }
  }

  _onPressLeft = () => {
    this.setState({dx: -1});
  }

  _onPressRight = () => {
    this.setState({dx: 1});
  }

  _onPressIn = () => {
    this.setState({dy: -1});
  }

  _onPressOut = () => {
    this.setState({dy: 1});
  }

  _onReleaseX = () => {
    this.setState({dx: 0});
  }

  _onReleaseY = () => {
    this.setState({dy: 0});
  }

  render() {
    return this.state.loaded ? (
      <View style={{flex: 1}} >
        <Game style={{ flex: 1 }} dx={this.state.dx} dy={this.state.dy} />
        <TouchableHighlight onPressIn={this._onPressLeft} onPressOut={this._onReleaseX} style={styles.leftButton} underlayColor="gray">
          <Text>LEFT</Text>
        </TouchableHighlight>
        <TouchableHighlight onPressIn={this._onPressRight} onPressOut={this._onReleaseX} style={styles.rightButton} underlayColor="gray">
          <Text>RIGHT</Text>
        </TouchableHighlight>
        <TouchableHighlight onPressIn={this._onPressIn} onPressOut={this._onReleaseY} style={styles.reelInButton} underlayColor="gray">
          <Text>IN</Text>
        </TouchableHighlight>
        <TouchableHighlight onPressIn={this._onPressOut} onPressOut={this._onReleaseY} style={styles.reelOutButton} underlayColor="gray">
          <Text>OUT</Text>
        </TouchableHighlight>
      </View>
    ) : (
      <Exponent.Components.AppLoading />
    );
  }
}

var styles = StyleSheet.create({
  leftButton: {width: 50, height: 50, position: 'absolute', backgroundColor: 'white', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 30, left: 10},
  rightButton: {width: 50, height: 50, position: 'absolute', backgroundColor: 'white', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 30, right: 10},
  reelInButton: {width: 50, height: 50, position: 'absolute', backgroundColor: 'white', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 90, left: 10},
  reelOutButton: {width: 50, height: 50, position: 'absolute', backgroundColor: 'white', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 90, right: 10},
});


Exponent.registerRootComponent(App);
