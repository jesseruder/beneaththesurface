import Exponent from 'exponent';
import React from 'react';
import { Alert, PanResponder, View, TouchableHighlight, Text, TouchableWithoutFeedback,
  StyleSheet, } from 'react-native';

import Assets from './Assets';
// import Game from './3DGame';
import Game from './2DGame';


//// App

// This is the root component of the app. It does any loading required
// then renders `Game`.
const GAME_TIME = 100;

class App extends React.Component {
  state = {
    loaded: false,
    gameLoaded: false,
    isShowingNux: true,
    isShowingMainMenu: false,
    score: 0,
    timeRemaining: GAME_TIME,
    isRunning: false,
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

  _updateScore = (d) => {
    this.setState({score: this.state.score + d});
  }

  tick = () => {
    if (!this.state.isRunning) {
      return;
    }

    let timeRemaining = Math.round((this.state.endTime - Date.now()) / 1000.0);
    if (timeRemaining !== this.state.timeRemaining) {
      let isRunning = timeRemaining > 0;

      this.setState({
        timeRemaining,
        isRunning,
        isShowingMainMenu: !isRunning,
      });
    }
  }

  onGameLoaded = () => {
    if (!this.state.gameLoaded) {
      this.setState({
        gameLoaded: true,
      });
    }
  }

  _doneWithNux = () => {
    this.setState({
      isShowingNux: false,
      isRunning: true,
    });
    this._resetGameState();
  }

  _doneWithMainMenu = () => {
    this.setState({
      isShowingMainMenu: false,
      isRunning: true,
    });
    this._resetGameState();
  }

  _resetGameState = () => {
    this.setState({
      dx: 0,
      dy: 0,
      score: 0,
      timeRemaining: GAME_TIME,
      endTime: Date.now() + GAME_TIME * 1000,
    });
  }

  render() {
    return this.state.loaded ? (
      <View style={{flex: 1}} >
        <Game style={{ flex: 1 }} dx={this.state.dx} dy={this.state.dy} updateScore={this._updateScore} tick={this.tick} isRunning={this.state.isRunning} onGameLoaded={this.onGameLoaded}/>
        <Text style={styles.time}>Time: {this.state.timeRemaining}</Text>
        <Text style={styles.score}>Score: {this.state.score}</Text>
        {this._renderControls()}
        {this._renderNux()}
        {this._renderMainMenu()}
        {this._renderLoading()}
      </View>
    ) : (
      <Exponent.Components.AppLoading />
    );
  }

  _renderControls() {
    if (!this.state.isRunning) return null;

    return (
      <View>
        <TouchableHighlight onPressIn={this._onPressLeft} onPressOut={this._onReleaseX} style={styles.leftButton} underlayColor="gray">
          <Text style={styles.font}>LEFT</Text>
        </TouchableHighlight>
        <TouchableHighlight onPressIn={this._onPressRight} onPressOut={this._onReleaseX} style={styles.rightButton} underlayColor="gray">
          <Text style={styles.font}>RIGHT</Text>
        </TouchableHighlight>
        <TouchableHighlight onPressIn={this._onPressIn} onPressOut={this._onReleaseY} style={styles.reelInButton} underlayColor="gray">
          <Text style={styles.font}>IN</Text>
        </TouchableHighlight>
        <TouchableHighlight onPressIn={this._onPressOut} onPressOut={this._onReleaseY} style={styles.reelOutButton} underlayColor="gray">
          <Text style={styles.font}>OUT</Text>
        </TouchableHighlight>
      </View>
    );
  }

  _renderNux() {
    if (!this.state.isShowingNux) return null;

    return (
        <View style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(135, 206, 250, 0.8)', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
          <TouchableWithoutFeedback onPress={this._doneWithNux} >
            <View>
              <Text style={styles.nuxText}>Reel in the fish to earn points before the time runs out! Touch the text to start.</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
    );
  }

  _renderMainMenu() {
    if (!this.state.isShowingMainMenu) return null;

    return (
      <View style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(135, 206, 250, 0.8)', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <TouchableWithoutFeedback onPress={this._doneWithMainMenu} >
          <View>
            <Text style={styles.mainMenuText}>You scored {this.state.score}! Touch to try again.</Text>
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  }

  _renderLoading() {
    if (this.state.gameLoaded) return null;

    return (<View style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: '#87CEFA'}}/>);
  }
}

var styles = StyleSheet.create({
  time: {fontWeight: 'bold', position: 'absolute', top: 30, left: 10},
  score: {fontWeight: 'bold', position: 'absolute', top: 30, right: 10},
  leftButton: {width: 50, height: 50, position: 'absolute', backgroundColor: '#cccccc', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 30, left: 10, borderRadius: 5},
  rightButton: {width: 50, height: 50, position: 'absolute', backgroundColor: '#cccccc', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 30, right: 10, borderRadius: 5},
  reelInButton: {width: 50, height: 50, position: 'absolute', backgroundColor: '#cccccc', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 90, left: 10, borderRadius: 5},
  reelOutButton: {width: 50, height: 50, position: 'absolute', backgroundColor: '#cccccc', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 90, right: 10, borderRadius: 5},
  font: {fontWeight: 'bold', fontSize: 14},
  nuxText: {fontSize: 20, width: 300, textAlign: 'center'},
  mainMenuText: {fontSize: 20, width: 300, textAlign: 'center'},
});


Exponent.registerRootComponent(App);
